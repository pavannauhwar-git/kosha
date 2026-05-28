import os

def update_references(directory):
    print(f"Scanning directory: {directory}")
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js') or file.endswith('.css'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                updated_content = content
                # Replace illustrations
                updated_content = updated_content.replace('/illustrations/404_not_found.png', '/illustrations/404_not_found.webp')
                updated_content = updated_content.replace('/illustrations/about_hero.png', '/illustrations/about_hero.webp')
                updated_content = updated_content.replace('/illustrations/all_done.png', '/illustrations/all_done.webp')
                updated_content = updated_content.replace('/illustrations/budget_empty.png', '/illustrations/budget_empty.webp')
                updated_content = updated_content.replace('/illustrations/coffee_chill.png', '/illustrations/coffee_chill.webp')
                updated_content = updated_content.replace('/illustrations/empty_loans.png', '/illustrations/empty_loans.webp')
                updated_content = updated_content.replace('/illustrations/empty_transactions.png', '/illustrations/empty_transactions.webp')
                updated_content = updated_content.replace('/illustrations/error_hero.png', '/illustrations/error_hero.webp')
                updated_content = updated_content.replace('/illustrations/guide_hero.png', '/illustrations/guide_hero.webp')
                updated_content = updated_content.replace('/illustrations/invite_hero.png', '/illustrations/invite_hero.webp')
                updated_content = updated_content.replace('/illustrations/monthly_empty.png', '/illustrations/monthly_empty.webp')
                updated_content = updated_content.replace('/illustrations/no_internet.png', '/illustrations/no_internet.webp')
                updated_content = updated_content.replace('/illustrations/onboarding_hero.png', '/illustrations/onboarding_hero.webp')
                updated_content = updated_content.replace('/illustrations/reconciliation_empty.png', '/illustrations/reconciliation_empty.webp')
                updated_content = updated_content.replace('/illustrations/report_bug.png', '/illustrations/report_bug.webp')
                updated_content = updated_content.replace('/illustrations/search_empty.png', '/illustrations/search_empty.webp')
                updated_content = updated_content.replace('/illustrations/settled_loans.png', '/illustrations/settled_loans.webp')
                updated_content = updated_content.replace('/illustrations/splitwise_group.png', '/illustrations/splitwise_group.webp')
                updated_content = updated_content.replace('/illustrations/yearly_empty.png', '/illustrations/yearly_empty.webp')

                # Replace banners
                for banner in ['goa', 'gujarat', 'karnataka', 'kerala', 'meghalaya', 'rajasthan', 'uttarakhand', 'himachal', 'maharashtra', 'tamil_nadu', 'punjab', 'sikkim']:
                    updated_content = updated_content.replace(f'/banners/{banner}.png', f'/banners/{banner}.webp')

                if updated_content != content:
                    print(f"Updating file: {file_path}")
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(updated_content)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    src_dir = os.path.join(base_dir, 'src')
    update_references(src_dir)
    print("Code reference updates completed.")
