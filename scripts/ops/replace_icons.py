import os
import re

LUCIDE_TO_PHOSPHOR = {
    'AlertCircle': 'WarningCircle',
    'AlertTriangle': 'Warning',
    'ArrowRight': 'ArrowRight',
    'ArrowLeft': 'ArrowLeft',
    'ArrowDownLeft': 'ArrowDownLeft',
    'ArrowUpRight': 'ArrowUpRight',
    'ArrowRightLeft': 'ArrowsLeftRight',
    'CheckCircle2': 'CheckCircle',
    'History': 'History',
    'Home': 'House',
    'Link2': 'Link',
    'RotateCcw': 'ArrowCounterClockwise',
    'RotateCw': 'ArrowClockwise',
    'ShieldCheck': 'ShieldCheck',
    'Plus': 'Plus',
    'Bug': 'Bug',
    'Check': 'Check',
    'Copy': 'Copy',
    'LogIn': 'SignIn',
    'LogOut': 'SignOut',
    'Wallet': 'Wallet',
    'TrendingDown': 'TrendingDown',
    'Camera': 'Camera',
    'Trash2': 'Trash',
    'Pencil': 'NotePencil',
    'BellRing': 'BellRinging',
    'ShieldAlert': 'ShieldWarning',
    'Users': 'Users',
    'User': 'User',
    'Moon': 'Moon',
    'Sun': 'Sun',
    'Unlink': 'LinkBreak',
    'ExternalLink': 'ArrowSquareOut',
    'Sparkles': 'Sparkles',
    'Search': 'MagnifyingGlass',
    'X': 'X',
    'SlidersHorizontal': 'Sliders',
    'Download': 'Download',
    'BookOpen': 'BookOpen',
    'Loader2': 'CircleNotch',
    'Eye': 'Eye',
    'ReceiptText': 'Receipt',
    'Settings2': 'Sliders',
    'Archive': 'Archive',
    'ArchiveRestore': 'Archive',
    'Repeat': 'Repeat',
    'CalendarDays': 'Calendar',
    'Calendar': 'Calendar',
    'MoreVertical': 'DotsThreeVertical',
    'ChevronDown': 'CaretDown',
    'ChevronLeft': 'CaretLeft',
    'ChevronRight': 'CaretRight',
    'Info': 'Info',
    'Percent': 'Percent',
    'FileText': 'FileText',
    'HandCoins': 'HandCoins',
    'LayoutGrid': 'SquaresFour',
    'LineChart': 'ChartLineUp',
    'Receipt': 'Receipt',
}

def migrate_icons_in_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the import line for lucide-react (restricted within one curly braces pair)
    import_match = re.search(r'import\s+{([^}]*?)}\s+from\s+[\'"]lucide-react[\'"]', content, re.DOTALL)
    if not import_match:
        return False

    imported_str = import_match.group(1)
    # Parse individual icons
    lucide_icons = [icon.strip() for icon in re.split(r',|\s+', imported_str) if icon.strip()]

    # Convert to Phosphor equivalent
    phosphor_icons = []
    failed_mappings = []
    
    for icon in lucide_icons:
        if icon in LUCIDE_TO_PHOSPHOR:
            phosphor_icons.append(LUCIDE_TO_PHOSPHOR[icon])
        else:
            failed_mappings.append(icon)
            # Default to same name if not in map
            phosphor_icons.append(icon)

    if failed_mappings:
        print(f"Warning in {file_path}: No mapping found for {failed_mappings}")

    # Remove duplicates
    phosphor_icons = sorted(list(set(phosphor_icons)))

    # Construct the new import statement
    new_import = f"import {{ {', '.join(phosphor_icons)} }} from '@phosphor-icons/react'"

    # Replace the lucide-react import block
    updated = content.replace(import_match.group(0), new_import)

    # Replace icon references inside the file
    for lucide_icon in lucide_icons:
        phosphor_icon = LUCIDE_TO_PHOSPHOR.get(lucide_icon, lucide_icon)
        if lucide_icon == phosphor_icon:
            continue

        # Use regex to replace exact variable or JSX tag matches
        # 1. JSX tags: <Icon, </Icon
        updated = re.sub(r'<' + lucide_icon + r'\b', '<' + phosphor_icon, updated)
        updated = re.sub(r'</' + lucide_icon + r'\b', '</' + phosphor_icon, updated)
        
        # 2. JSX attributes or direct assignments: ={Icon}, {Icon}, : Icon, [Icon], etc.
        updated = re.sub(r'=' + lucide_icon + r'\b', '=' + phosphor_icon, updated)
        updated = re.sub(r'{\s*' + lucide_icon + r'\s*}', '{' + phosphor_icon + '}', updated)
        updated = re.sub(r':\s*' + lucide_icon + r'\b', ': ' + phosphor_icon, updated)
        updated = re.sub(r'\[\s*' + lucide_icon + r'\s*\]', '[' + phosphor_icon + ']', updated)
        
        # 3. Variable lists / arrays / destructurings
        updated = re.sub(r'\b' + lucide_icon + r'\b', phosphor_icon, updated)

    print(f"Successfully migrated icons in: {file_path}")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(updated)
    return True

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    src_dir = os.path.join(base_dir, 'src')

    # Get all target files
    target_files = []
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if "from 'lucide-react'" in content or 'from "lucide-react"' in content:
                    target_files.append(path)

    print(f"Found {len(target_files)} files containing lucide-react imports.")
    for path in target_files:
        migrate_icons_in_file(path)
    
    print("Icon migration completed.")
