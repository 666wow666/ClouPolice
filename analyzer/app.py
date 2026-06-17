from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from config import Config
from modules.pdf_converter import process_file
from modules.llm_extractor import extract_key_info_and_audit


app = Flask(__name__)

LAST_CONTENT = {"text": "", "case": ""}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analysis')
def analysis_page():
    """分析结果页面"""
    return render_template('analysis.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "未发现上传文件"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "文件名为空"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "不支持的文件格式"}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(Config.UPLOAD_FOLDER, filename)
    file.save(save_path)

    try:
        content = process_file(save_path)
        LAST_CONTENT["text"] = content
        LAST_CONTENT["case"] = filename
        return jsonify({
            "message": f"文件 {filename} 上传成功",
            "content_preview": content[:1500]
        })
    except Exception as e:
        return jsonify({"error": f"文件处理失败: {str(e)}"}), 500


@app.route('/cases', methods=['GET'])
def list_cases():
    """列出 data/file 目录下所有子文件夹内的 询问笔录.txt"""
    case_dir = Config.CASE_FOLDER
    cases = []
    if not os.path.isdir(case_dir):
        return jsonify({"cases": cases})
    try:
        folders_with_time = []
        for folder in os.listdir(case_dir):
            folder_path = os.path.join(case_dir, folder)
            if not os.path.isdir(folder_path):
                continue
            record_file = os.path.join(folder_path, '询问笔录.txt')
            if not os.path.isfile(record_file):
                continue
            stat = os.stat(record_file)
            folders_with_time.append((folder, stat, record_file))
        folders_with_time.sort(key=lambda x: x[1].st_mtime, reverse=True)

        for folder, stat, record_file in folders_with_time:
            try:
                with open(record_file, 'r', encoding='utf-8') as f:
                    snippet = f.read(80).strip().replace('\n', ' ')
            except Exception:
                snippet = ''
            # 案件名称只显示第一个 _ 之前的内容
            case_name = folder.split('_')[0] if '_' in folder else folder
            cases.append({
                "case_id": folder,
                "name": case_name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
                "snippet": snippet
            })
        return jsonify({"cases": cases})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/select-case', methods=['POST'])
def select_case():
    """读取指定案件文件夹内的 询问笔录.txt"""
    data = request.get_json() or {}
    case_id = (data.get("case_id") or "").strip()
    if not case_id:
        return jsonify({"error": "未指定案件"}), 400
    # 路径安全检查
    if '..' in case_id or '/' in case_id or '\\' in case_id:
        return jsonify({"error": "非法路径"}), 400
    folder_path = os.path.join(Config.CASE_FOLDER, case_id)
    record_file = os.path.join(folder_path, '询问笔录.txt')
    if not os.path.isfile(record_file):
        return jsonify({"error": f"未找到询问笔录: {case_id}/询问笔录.txt"}), 404
    try:
        with open(record_file, 'r', encoding='utf-8') as f:
            content = f.read()
        LAST_CONTENT["text"] = content
        LAST_CONTENT["case"] = case_id
        return jsonify({
            "case_id": case_id,
            "content": content,
            "total_length": len(content)
        })
    except Exception as e:
        return jsonify({"error": f"读取失败: {str(e)}"}), 500


@app.route('/extract', methods=['POST'])
def extract():
    content = LAST_CONTENT.get("text", "")
    case_id = LAST_CONTENT.get("case", "")
    if not content:
        return jsonify({"error": "请先选择案件"}), 400
    try:
        result = extract_key_info_and_audit(content)
        # 保存分析结果到案件文件夹
        if case_id:
            folder_path = os.path.join(Config.CASE_FOLDER, case_id)
            analysis_file = os.path.join(folder_path, '分析数据.json')
            try:
                import json
                with open(analysis_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
            except Exception as save_err:
                print(f"保存分析结果失败: {save_err}")
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"分析失败: {str(e)}"}), 500


@app.route('/load-analysis', methods=['POST'])
def load_analysis():
    """加载指定案件已有的分析数据"""
    data = request.get_json() or {}
    case_id = (data.get("case_id") or "").strip()
    if not case_id:
        return jsonify({"error": "未指定案件"}), 400
    if '..' in case_id or '/' in case_id or '\\' in case_id:
        return jsonify({"error": "非法路径"}), 400
    folder_path = os.path.join(Config.CASE_FOLDER, case_id)
    analysis_file = os.path.join(folder_path, '分析数据.json')
    if not os.path.isfile(analysis_file):
        return jsonify({"exists": False, "error": "暂无分析数据"}), 404
    try:
        import json
        with open(analysis_file, 'r', encoding='utf-8') as f:
            result = json.load(f)
        return jsonify({"exists": True, "data": result})
    except Exception as e:
        return jsonify({"exists": False, "error": f"加载失败: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)