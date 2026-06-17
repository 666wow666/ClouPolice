# test_api.py
from openai import OpenAI
from config import Config

print("=" * 50)
print("🔑 API Key:", Config.QWEN_API_KEY[:15] + "..." if Config.QWEN_API_KEY else "❌ 未配置")
print("📦 Model:", Config.QWEN_MODEL)
print("🌐 Base URL:", Config.QWEN_BASE_URL)
print("=" * 50)

if not Config.QWEN_API_KEY:
    print("❌ 请先在 config.py 中配置 API Key")
    exit(1)

client = OpenAI(
    api_key=Config.QWEN_API_KEY,
    base_url=Config.QWEN_BASE_URL,
    timeout=30.0  # 设置超时时间
)

try:
    print("⏳ 正在调用 Qwen API...")
    response = client.chat.completions.create(
        model=Config.QWEN_MODEL,
        messages=[
            {"role": "system", "content": "你是一个测试助手。"},
            {"role": "user", "content": "请回复：API测试成功"}
        ],
        max_tokens=50
    )
    print("✅ API 调用成功!")
    print("📤 返回内容:", response.choices[0].message.content)
    print("=" * 50)
    
except Exception as e:
    print("❌ API 调用失败:", e)
    print("=" * 50)