import os
import subprocess
import glob
import re
from config import Config

def process_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.txt':
        return read_txt_safe(file_path)
    elif ext == '.pdf':
        md_path = pdf_to_markdown(file_path)
        return read_markdown_clean(md_path)
    else:
        raise ValueError(f'不支持的文件格式: {ext}')

def pdf_to_markdown(pdf_path: str) -> str:
    output_dir = Config.OUTPUT_FOLDER
    os.makedirs(output_dir, exist_ok=True)
    cmd = ['magic-pdf', '-p', pdf_path, '-o', output_dir]
    try:
        subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', check=True)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        md_subdir = os.path.join(output_dir, base_name)
        md_files = glob.glob(os.path.join(md_subdir, '*.md'))
        if not md_files:
            raise FileNotFoundError(f'未找到MD文件: {md_subdir}')
        return md_files[0]
    except subprocess.CalledProcessError as e:
        raise Exception(f'MinerU转换失败: {e.stderr}')

def read_txt_safe(file_path: str) -> str:
    for enc in ['utf-8', 'gbk', 'gb2312', 'utf-16']:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise Exception('无法解析的文件编码')

def read_markdown_clean(md_path: str) -> str:
    if not os.path.exists(md_path):
        return ''
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
    return content
