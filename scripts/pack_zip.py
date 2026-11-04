import os
import zipfile

def make_zip(output_path, root_dir):
    exclude_dirs = {'node_modules', 'dist', '.git', '.cache'}
    exclude_exts = {'.zip', '.pyc'}

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for dirpath, dirnames, filenames in os.walk(root_dir):
            dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext in exclude_exts or filename.startswith('.'):
                    if filename not in {'.env.example', '.gitignore'}:
                        continue
                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, root_dir)
                if rel_path.endswith('.zip'):
                    continue
                zipf.write(full_path, rel_path)

if __name__ == '__main__':
    make_zip('docpilot-source.zip', '.')
    print(f"Generated docpilot-source.zip ({os.path.getsize('docpilot-source.zip')} bytes)")
