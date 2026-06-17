import os

class Config:
    # 1. API 配置
    QWEN_API_KEY = "sk-f04c8a68417d48b2b3c6edb14c0c3639"  # 务必更换为新生成的Key
    QWEN_MODEL = "qwen-plus"
    QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    
    # 2. 路径配置
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    # 项目根目录（Flask 从 analyzer/ 启动）
    PROJECT_ROOT = os.path.dirname(BASE_DIR)
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "data", "uploads")
    OUTPUT_FOLDER = os.path.join(BASE_DIR, "data", "outputs")
    # 读取项目根目录 data/file/<案件文件夹>/询问笔录.txt
    CASE_FOLDER = os.path.join(PROJECT_ROOT, "data", "file")
    
    # 3. 业务配置
    ALLOWED_EXTENSIONS = {'pdf', 'txt'} # 增加对 txt 的支持
    REQUIRED_FIELDS = ["询问时间", "询问地点", "被询问人姓名", "询问人姓名", "记录人姓名"]
    KEYWORDS_RISK = ["刑讯逼供", "威胁", "引诱", "欺骗"]
    LLM_TEMPERATURE = 0.1

    @classmethod
    def init_app(cls):
        """启动时自动创建必要目录"""
        for path in [cls.UPLOAD_FOLDER, cls.OUTPUT_FOLDER, cls.CASE_FOLDER]:
            os.makedirs(path, exist_ok=True)

Config.init_app()