# modules/llm_extractor.py
from openai import OpenAI
from config import Config
import json
import re

# 初始化Qwen客户端
client = OpenAI(
    api_key=Config.QWEN_API_KEY,
    base_url=Config.QWEN_BASE_URL
)


def extract_key_info_and_audit(markdown_content: str) -> dict:
    """
    输入笔录全文(Markdown)，调用Qwen返回提取的要点和合规审查结果。
    返回的结构化数据包含：
    - extraction: 基本信息要素
    - audit: 合规/评分/风险/时间线/关键词/证据图谱/建议等
    """
    # 为防止内容过长，截取前8000字
    truncated_content = markdown_content[:8000]

    system_prompt = """你是一名专业的公安案件笔录审查专家，拥有丰富的刑侦和案卷审查经验。你的任务是仔细阅读案件笔录，提取结构化信息并进行合规性审查。你必须严格按照给定的 JSON 格式返回结果，不要输出任何额外文字或说明。"""

    user_prompt = f"""请仔细阅读以下案件笔录内容，完成信息提取与合规审查两项任务。

【任务1：信息要素提取（extraction）】
从笔录中识别并填入以下字段。如果没有明确提到，请填写字符串"未提及"。
- 案发时间（格式：YYYY-MM-DD HH:mm，若仅有日期则补 00:00）
- 报案时间（同上格式）
- 案发地点
- 被询问人姓名
- 询问人姓名
- 记录人姓名
- 事件经过（1-2 句概括，约 60-100 字）
- 涉案金额（如有数字请直接写出金额数字与币种，如"¥50,000"；如无则"未提及"）
- 关键证据（简述笔录中提到的主要证据，以顿号分隔）

【任务2：合规与深度审查（audit）】
请基于笔录进行如下结构化分析：
2.1 missing_items: 字符串数组，列出上述"未提及"的字段名（仅列字段名）。
2.2 compliance_checks: 对象数组，每项为 {{ "key": "检查项", "found": true/false, "desc": "简短描述" }}，检查项固定为：刑讯逼供、疲劳审讯、欺骗诱导、未告知权利义务、其他违规行为。found=true 代表存在风险。
2.3 程序瑕疵: 字符串数组，如有其它程序问题可补充（也可空数组）。
2.4 逻辑矛盾: 字符串数组，列出前后矛盾/不合理之处（如无则空数组）。
2.5 risk_items: 对象数组，将所有风险点（缺失+程序瑕疵+矛盾）归纳为 {{ "level": "高"/"中"/"低", "category": "要素缺失/程序瑕疵/事实矛盾/逻辑矛盾/其他", "desc": "简短描述" }}。
2.6 conflict_distribution: 对象 {{ "时间矛盾": n, "金额矛盾": n, "事实矛盾": n, "逻辑矛盾": n }}，统计各类矛盾点数量（整数）。
2.7 timeline: 对象数组，按照时间先后列出 5-10 个关键事件节点 {{ "time": "HH:mm 或 YYYY-MM-DD HH:mm", "event": "事件描述", "status": "normal/warn/miss" }}。status=warn 表示存在风险/异常，miss 表示信息缺失/需要核实。
2.8 keywords: 对象数组，10-20 个高频/关键词 {{ "name": "关键词", "value": 权重整数 }}。权重 20-150，越重要越大。
2.9 evidence_graph: 对象 {{ "nodes": [...], "links": [...], "categories": [...] }}。nodes 中每项 {{ "name": "节点名", "category": 0或1, "symbolSize": 整数（50-90） }}，category=0 为核心事件，1 为证据。links 中每项 {{ "source": "源节点名", "target": "目标节点名" }}。categories 固定为 [{{"name":"核心"}}, {{"name":"证据"}}]。
2.10 advice: 字符串数组，给出 3-5 条具体改进建议（需要补充的信息、需要核实的内容等）。
2.11 credibility: 字符串 "高"/"中高"/"中"/"低"，对笔录可信度的综合评估。
2.12 total_score: 0-100 的整数，综合评分（参考：要素完整度40% + 程序合规40% + 矛盾处理20%）。
2.13 审查结论: 字符串，80-150 字的审查结论与意见。

【输出格式】
严格输出一个合法 JSON，结构如下：
{{
  "extraction": {{
    "案发时间": "...", "报案时间": "...", "案发地点": "...",
    "被询问人姓名": "...", "询问人姓名": "...", "记录人姓名": "...",
    "事件经过": "...", "涉案金额": "...", "关键证据": "..."
  }},
  "audit": {{
    "missing_items": ["..."],
    "compliance_checks": [...],
    "程序瑕疵": ["..."],
    "逻辑矛盾": ["..."],
    "risk_items": [...],
    "conflict_distribution": {{...}},
    "timeline": [...],
    "keywords": [...],
    "evidence_graph": {{...}},
    "advice": ["..."],
    "credibility": "高",
    "total_score": 85,
    "审查结论": "..."
  }}
}}

【重要约束】
- 必须输出合法 JSON，禁止输出 ```json 代码块标记或其他文字
- 所有字符串必须使用双引号
- 数值字段必须为整数/布尔，不得使用字符串代替
- 如果缺少信息，请根据常识给出合理判断并填充，不要留空

【笔录内容】
{truncated_content}
"""

    try:
        response = client.chat.completions.create(
            model=Config.QWEN_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=4000,
            top_p=0.9
        )

        result_text = response.choices[0].message.content or ""
        print("=" * 60)
        print("📤 Qwen API 返回内容（前500字符）:")
        print(result_text[:500])
        print("=" * 60)

        # 清洗可能的 ```json / ``` 包裹
        if "```json" in result_text:
            result_text = result_text.split("```json", 1)[1].rsplit("```", 1)[0]
        elif "```" in result_text:
            result_text = result_text.split("```", 1)[1].rsplit("```", 1)[0]

        result_text = result_text.strip()

        # 首字符不是 '{' 则尝试提取
        if not result_text.startswith("{"):
            match = re.search(r"\{[\s\S]*\}", result_text)
            if match:
                result_text = match.group(0)
            else:
                raise ValueError("无法从返回内容中提取 JSON 对象")

        parsed_result = json.loads(result_text)

        # 基础结构校验
        if not isinstance(parsed_result.get("extraction"), dict):
            parsed_result["extraction"] = {}
        if not isinstance(parsed_result.get("audit"), dict):
            parsed_result["audit"] = {}

        return parsed_result

    except json.JSONDecodeError as e:
        print(f"❌ JSON解析失败: {e}")
        return {
            "extraction": {},
            "audit": {
                "missing_items": [],
                "compliance_checks": [],
                "程序瑕疵": [],
                "逻辑矛盾": [],
                "risk_items": [],
                "conflict_distribution": {"时间矛盾": 0, "金额矛盾": 0, "事实矛盾": 0, "逻辑矛盾": 0},
                "timeline": [],
                "keywords": [],
                "evidence_graph": {"nodes": [], "links": [], "categories": [{"name": "核心"}, {"name": "证据"}]},
                "advice": [],
                "credibility": "未知",
                "total_score": 0,
                "审查结论": f"AI分析失败: {str(e)}"
            }
        }
    except Exception as e:
        print(f"❌ Qwen API调用失败: {e}")
        return {
            "extraction": {},
            "audit": {
                "missing_items": [],
                "compliance_checks": [],
                "程序瑕疵": [],
                "逻辑矛盾": [],
                "risk_items": [],
                "conflict_distribution": {"时间矛盾": 0, "金额矛盾": 0, "事实矛盾": 0, "逻辑矛盾": 0},
                "timeline": [],
                "keywords": [],
                "evidence_graph": {"nodes": [], "links": [], "categories": [{"name": "核心"}, {"name": "证据"}]},
                "advice": [],
                "credibility": "未知",
                "total_score": 0,
                "审查结论": f"AI分析失败: {str(e)}"
            }
        }
