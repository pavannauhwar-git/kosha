import re

with open("src/pages/Dashboard.jsx", "r") as f:
    content = f.read()

# remove useAppData import and usage
content = re.sub(r"import \{ useAppData \} from '\.\./hooks/useAppDataStore'\n", "", content)
content = re.sub(r"const \{ addOptimisticDelete, removeOptimisticDelete, addOptimisticEdit, removeOptimisticEdit \} = useAppData\(\)\n", "", content)

# update handles to remove addOptimisticEdit / removeOptimisticEdit / delete logic that requires it
content = re.sub(r"addOptimisticEdit\(.*?\)", "", content)
content = re.sub(r"removeOptimisticEdit\(.*?\)", "", content)
content = re.sub(r"addOptimisticDelete\(.*?\)", "", content)
content = re.sub(r"removeOptimisticDelete\(.*?\)", "", content)
content = re.sub(r"applyLocalEdit\(.*?\)", "", content)
content = re.sub(r"clearLocalEdit\(.*?\)", "", content)
content = re.sub(r"revertLocalEdit\(.*?\)", "", content)

with open("src/pages/Dashboard.jsx", "w") as f:
    f.write(content)
