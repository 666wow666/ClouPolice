import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  Badge,
  Statistic,
  Table,
  Timeline,
  Descriptions,
  Alert,
  Button,
  Tabs,
  Space,
  Typography,
  Tooltip,
  Divider,
  List,
  Switch,
  message
} from 'antd';
import {
  SafetyCertificateOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  MoneyCollectOutlined,
  DeleteOutlined,
  LeftOutlined,
  EyeOutlined,
  EditOutlined,
  ArrowRightOutlined,
  TrophyOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import * as echarts from 'echarts';
import 'echarts-wordcloud';

const { Title, Text, Paragraph } = Typography;

// 主题色
const THEME = {
  primary: '#5ba0ff',
  success: '#4ad991',
  warning: '#f5a524',
  danger: '#ff6b6b',
  bg: '#0d1b3a',
  panel: '#152347',
  text: '#dbe7ff',
  textMute: '#8fa4c0'
};

// 综合评分环形进度组件
const ScoreRing = ({ value, max = 100, label, status }) => {
  const colorMap = {
    good: THEME.success,
    warning: THEME.warning,
    danger: THEME.danger
  };
  const color = status ? colorMap[status] : (value >= 85 ? THEME.success : value >= 65 ? THEME.warning : THEME.danger);
  
  return (
    <Card 
      size="small" 
      style={{ 
        background: 'linear-gradient(135deg, #1b2d5a 0%, #152347 100%)',
        border: `1px solid ${color}40`,
        borderRadius: 12,
        textAlign: 'center'
      }}
    >
      <Progress
        type="dashboard"
        percent={(value / max * 100).toFixed(0)}
        strokeColor={color}
        trailColor="rgba(255,255,255,0.1)"
        format={() => (
          <div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: color }}>
              {value}<span style={{ fontSize: 14 }}>/{max}</span>
            </div>
            <div style={{ fontSize: 12, color: THEME.textMute }}>{label}</div>
          </div>
        )}
      />
    </Card>
  );
};

// 要素状态标签
const ElementTag = ({ label, value }) => {
  const isOk = value && value !== '未提及';
  return (
    <Tag 
      icon={isOk ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
      color={isOk ? 'success' : 'error'}
      style={{ margin: '4px', borderRadius: 6 }}
    >
      {label}: {value || '未提及'}
    </Tag>
  );
};

// 风险等级徽章
const RiskBadge = ({ level }) => {
  const config = {
    高: { color: 'error', text: '高风险' },
    中: { color: 'warning', text: '中风险' },
    低: { color: 'success', text: '低风险' }
  };
  const { color, text } = config[level] || config.低;
  return <Badge status={color} text={<Text style={{ color }}>{text}</Text>} />;
};

// 可视化雷达图
const RadarChart = ({ data }) => {
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      radar: {
        indicator: [
          { name: '要素完整性', max: 100 },
          { name: '合规性', max: 100 },
          { name: '一致性', max: 100 },
          { name: '可信度', max: 100 }
        ],
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: THEME.textMute },
        splitLine: { lineStyle: { color: 'rgba(91,160,255,0.15)' } },
        splitArea: { areaStyle: { color: ['#152347', '#1b2d5a'] } },
        axisLine: { lineStyle: { color: 'rgba(91,160,255,0.3)' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: data,
          areaStyle: { color: 'rgba(91,160,255,0.3)' },
          lineStyle: { color: THEME.primary, width: 2 },
          itemStyle: { color: THEME.primary }
        }]
      }]
    });
    
    const timer = setTimeout(() => chart.resize(), 100);
    return () => {
      clearTimeout(timer);
      chart.dispose();
    };
  }, [data]);
  
  return <div ref={chartRef} style={{ width: '100%', height: 200 }} />;
};

// 矛盾类型饼图
const ConflictPieChart = ({ data }) => {
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { 
        orient: 'vertical', 
        right: 10, 
        top: 'center',
        textStyle: { color: THEME.text },
        itemWidth: 10,
        itemHeight: 10
      },
      series: [{
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        data: Object.entries(data).map(([name, value], i) => ({
          name,
          value,
          itemStyle: { color: [THEME.primary, THEME.success, THEME.warning, THEME.danger][i % 4] }
        }))
      }]
    });
    
    const timer = setTimeout(() => chart.resize(), 100);
    return () => {
      clearTimeout(timer);
      chart.dispose();
    };
  }, [data]);
  
  return <div ref={chartRef} style={{ width: '100%', height: 180 }} />;
};

// 风险等级柱状图
const RiskBarChart = ({ high, mid, low, none }) => {
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      grid: { left: 60, right: 20, top: 10, bottom: 30 },
      xAxis: { 
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(91,160,255,0.25)' } },
        axisLabel: { color: THEME.textMute },
        splitLine: { lineStyle: { color: 'rgba(91,160,255,0.1)' } }
      },
      yAxis: { 
        type: 'category', 
        data: ['高风险', '中风险', '低风险', '无风险'],
        axisLine: { lineStyle: { color: 'rgba(91,160,255,0.25)' } },
        axisLabel: { color: THEME.text }
      },
      series: [{
        type: 'bar',
        barWidth: 16,
        data: [
          { value: high, itemStyle: { color: THEME.danger } },
          { value: mid, itemStyle: { color: THEME.warning } },
          { value: low, itemStyle: { color: '#ffd166' } },
          { value: none, itemStyle: { color: THEME.success } }
        ],
        label: { show: true, position: 'right', color: THEME.text }
      }]
    });
    
    const timer = setTimeout(() => chart.resize(), 100);
    return () => {
      clearTimeout(timer);
      chart.dispose();
    };
  }, [high, mid, low, none]);
  
  return <div ref={chartRef} style={{ width: '100%', height: 160 }} />;
};

// 词云图
const WordCloudChart = ({ data }) => {
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    const palette = [THEME.primary, THEME.success, THEME.warning, THEME.danger, '#b57bff', '#3ec6e0', '#ffd166'];
    chart.setOption({
      tooltip: { show: true },
      series: [{
        type: 'wordCloud',
        shape: 'circle',
        left: 'center',
        top: 'center',
        width: '90%',
        height: '90%',
        sizeRange: [14, 48],
        rotationRange: [-30, 30],
        gridSize: 8,
        drawOutOfBound: false,
        textStyle: {
          fontWeight: 'bold',
          color: () => palette[Math.floor(Math.random() * palette.length)]
        },
        emphasis: {
          textStyle: {
            color: '#fff',
            textShadowBlur: 10,
            textShadowColor: THEME.primary
          }
        },
        data: data
      }]
    });
    
    const timer = setTimeout(() => chart.resize(), 100);
    return () => {
      clearTimeout(timer);
      chart.dispose();
    };
  }, [data]);
  
  return <div ref={chartRef} style={{ width: '100%', height: 300 }} />;
};

// 证据关系图谱
const EvidenceGraphChart = ({ nodes, links, categories }) => {
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      tooltip: {},
      legend: [{ data: categories.map(c => c.name), textStyle: { color: THEME.text } }],
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        force: { repulsion: 300, edgeLength: 100 },
        label: { show: true, position: 'bottom', color: THEME.text, fontSize: 11 },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 6,
        lineStyle: { color: THEME.primary, opacity: 0.6, width: 1.5 },
        data: nodes.map(n => ({
          ...n,
          itemStyle: { 
            color: n.category === 0 ? THEME.primary : THEME.success,
            borderColor: '#fff',
            borderWidth: 2
          }
        })),
        links,
        categories
      }]
    });
    
    const timer = setTimeout(() => chart.resize(), 100);
    return () => {
      clearTimeout(timer);
      chart.dispose();
    };
  }, [nodes, links, categories]);
  
  return <div ref={chartRef} style={{ width: '100%', height: 280 }} />;
};

// 合规检查项
const ComplianceCheckItem = ({ item }) => {
  const isOk = !item.found;
  return (
    <List.Item>
      <Tag 
        icon={isOk ? <CheckCircleOutlined /> : <WarningOutlined />} 
        color={isOk ? 'success' : 'warning'}
        style={{ background: 'transparent', borderColor: isOk ? THEME.success : THEME.warning, color: isOk ? THEME.success : THEME.warning }}
      >
        {item.key}: {item.desc || (item.found ? '存在风险' : '未发现')}
      </Tag>
    </List.Item>
  );
};

// 主要分析组件
const AnalysisDashboard = ({ caseId, caseName, analysisData }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!analysisData) {
        try {
          // 尝试加载已有分析数据
          const checkRes = await fetch('load-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ case_id: caseId })
          });
          
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.exists) {
              setData(normalizeResult(checkData.data));
              setLoading(false);
              return;
            }
          }
          
          // 需要执行新分析
          await fetch('select-case', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ case_id: caseId })
          });
          
          const extractRes = await fetch('extract', { method: 'POST' });
          const extractData = await extractRes.json();
          if (extractData.error) throw new Error(extractData.error);
          
          setData(normalizeResult(extractData));
        } catch (err) {
          message.error('加载失败: ' + err.message);
        }
      } else {
        setData(normalizeResult(analysisData));
      }
      setLoading(false);
    };
    
    loadData();
  }, [caseId, analysisData]);

  const normalizeResult = (d) => {
    const ext = d.extraction || {};
    const aud = d.audit || {};

    const basic = {
      '案发时间': ext['案发时间'] || ext['时间'] || '未提及',
      '报案时间': ext['报案时间'] || '未提及',
      '案发地点': ext['案发地点'] || ext['地点'] || '未提及',
      '被询问人姓名': ext['被询问人姓名'] || '未提及',
      '询问人姓名': ext['询问人姓名'] || '未提及',
      '记录人姓名': ext['记录人姓名'] || '未提及',
      '事件经过': ext['事件经过'] || '未提及',
      '涉案金额': ext['涉案金额'] || '未提及',
      '关键证据': ext['关键证据'] || '未提及'
    };

    let missing = aud.missing_items || aud.缺失项 || [];
    if (!missing.length) {
      missing = Object.entries(basic).filter(([k, v]) => !v || v === '未提及').map(([k]) => k);
    }

    const totalFields = Object.keys(basic).length;
    const elementsRate = Math.round(((totalFields - missing.length) / totalFields) * 100);

    const complianceChecks = aud.compliance_checks || [
      { key: '刑讯逼供', found: false, desc: '未发现' },
      { key: '疲劳审讯', found: false, desc: '未发现' },
      { key: '欺骗、诱导', found: false, desc: '未发现' },
      { key: '未告知权利义务', found: (aud.程序瑕疵 || []).some(t => /权利义务|告知/.test(t)), desc: (aud.程序瑕疵 || []).some(t => /权利义务|告知/.test(t)) ? '存在风险' : '未发现' },
      { key: '其他违规行为', found: false, desc: '未发现' }
    ];
    const complianceIssues = complianceChecks.filter(c => c.found).length;
    const complianceRate = Math.max(0, 100 - complianceIssues * 20 - (aud.程序瑕疵 || []).length * 5);

    const risks = aud.risk_items || (aud.逻辑矛盾 || []).map((t, i) => ({
      level: /严重|高/.test(t) ? '高' : (/轻微|中/.test(t) ? '中' : '低'),
      category: '逻辑矛盾',
      desc: t
    }));
    const highRisk = risks.filter(r => r.level === '高').length;
    const midRisk = risks.filter(r => r.level === '中').length;
    const lowRisk = risks.filter(r => r.level === '低').length;
    const noRisk = Math.max(0, 5 - highRisk - midRisk - lowRisk);

    let totalScore = aud.total_score;
    if (!totalScore) {
      totalScore = Math.round((elementsRate * 0.4 + complianceRate * 0.4 + Math.max(30, 100 - highRisk * 15 - midRisk * 8) * 0.2));
      totalScore = Math.min(100, Math.max(0, totalScore));
    }

    const conflictCats = aud.conflict_distribution || {
      '时间矛盾': risks.filter(r => /时间/.test(r.desc) || r.category === '时间矛盾').length || 0,
      '金额矛盾': risks.filter(r => /金额|钱/.test(r.desc) || r.category === '金额矛盾').length || 0,
      '事实矛盾': risks.filter(r => /事实|证人|描述/.test(r.desc) || r.category === '事实矛盾').length || 1,
      '逻辑矛盾': risks.filter(r => r.category === '逻辑矛盾' || /矛盾|不合理/.test(r.desc)).length || 0
    };

    const timeline = aud.timeline || [];
    const keywords = aud.keywords || [];
    const evidenceGraph = aud.evidence_graph || { nodes: [], links: [], categories: [] };
    const advice = aud.advice || [];
    const conclusion = aud.审查结论 || aud.conclusion || '笔录整体内容较为完整，合规性存在个别风险，存在部分矛盾点需要进一步核实，建议补充缺失信息并重点核查高风险内容。';
    const credibility = aud.credibility || (highRisk > 0 ? '中' : (midRisk > 0 ? '中高' : '高'));
    const riskTag = highRisk > 0 ? '高风险' : (midRisk > 0 ? '中风险' : '低风险');

    return {
      basic, missing, elementsRate,
      complianceChecks, complianceRate,
      risks, highRisk, midRisk, lowRisk, noRisk,
      conflictCats,
      totalScore,
      credibility, riskTag,
      timeline, keywords, evidenceGraph,
      advice, conclusion
    };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Text style={{ color: THEME.textMute }}>正在加载分析数据...</Text>
      </div>
    );
  }

  if (!data) {
    return (
      <Alert
        type="error"
        message="数据加载失败"
        description="无法获取分析数据，请返回重试"
        showIcon
      />
    );
  }

  // 计算雷达图数据
  const radarData = [
    data.elementsRate,
    data.complianceRate,
    Math.max(30, 100 - data.highRisk * 15 - data.midRisk * 8),
    data.credibility === '高' ? 90 : data.credibility === '中高' ? 70 : 50
  ];

  return (
    <div className="analysis-root">
      {/* 顶部评分卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card className="analysis-score-card" style={{ textAlign: 'center' }}>
            <Statistic
              title={<Text style={{ color: THEME.textMute }}>综合评分</Text>}
              value={data.totalScore}
              suffix="/100"
              valueStyle={{ color: data.totalScore >= 85 ? THEME.success : data.totalScore >= 65 ? THEME.warning : THEME.danger }}
              prefix={<TrophyOutlined />}
            />
            <Tag 
              color={data.totalScore >= 85 ? 'success' : data.totalScore >= 65 ? 'warning' : 'error'}
              style={{ marginTop: 8, borderRadius: 12 }}
            >
              {data.totalScore >= 85 ? '良好' : data.totalScore >= 65 ? '一般' : '需核查'}
            </Tag>
          </Card>
        </Col>
        <Col span={4}>
          <Card className="analysis-score-card" style={{ textAlign: 'center' }}>
            <Statistic
              title={<Text style={{ color: THEME.textMute }}>要素完整性</Text>}
              value={data.elementsRate}
              suffix="%"
              valueStyle={{ color: THEME.success }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="analysis-score-card" style={{ textAlign: 'center' }}>
            <Statistic
              title={<Text style={{ color: THEME.textMute }}>合规性得分</Text>}
              value={data.complianceRate}
              suffix="%"
              valueStyle={{ color: THEME.primary }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="analysis-score-card" style={{ textAlign: 'center' }}>
            <Statistic
              title={<Text style={{ color: THEME.textMute }}>矛盾风险</Text>}
              value={data.highRisk + data.midRisk}
              valueStyle={{ color: data.highRisk > 0 ? THEME.danger : data.midRisk > 0 ? THEME.warning : THEME.success }}
              prefix={<WarningOutlined />}
            />
            <Tag 
              color={data.highRisk > 0 ? 'error' : data.midRisk > 0 ? 'warning' : 'success'}
              style={{ marginTop: 8, borderRadius: 12 }}
            >
              {data.riskTag}
            </Tag>
          </Card>
        </Col>
        <Col span={4}>
          <Card className="analysis-score-card" style={{ textAlign: 'center' }}>
            <Statistic
              title={<Text style={{ color: THEME.textMute }}>笔录可信度</Text>}
              value={data.credibility}
              valueStyle={{ 
                color: data.credibility === '高' ? THEME.success : data.credibility === '中' ? THEME.warning : THEME.danger 
              }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="analysis-score-card" style={{ textAlign: 'center' }}>
            <Statistic
              title={<Text style={{ color: THEME.textMute }}>风险项总数</Text>}
              value={data.risks.length}
              valueStyle={{ color: '#b57bff' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 雷达图概览 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card className="analysis-card" title={<span className="analysis-title"><InfoCircleOutlined /> 综合能力雷达图</span>}>
            <RadarChart data={radarData} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="analysis-card" title={<span className="analysis-title"><WarningOutlined /> 矛盾类型分布</span>}>
            <ConflictPieChart data={data.conflictCats} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="analysis-card" title={<span className="analysis-title"><ExclamationCircleOutlined /> 风险等级分布</span>}>
            <RiskBarChart 
              high={data.highRisk} 
              mid={data.midRisk} 
              low={data.lowRisk} 
              none={data.noRisk} 
            />
          </Card>
        </Col>
      </Row>

      {/* 基本信息与合规性 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Card className="analysis-card" title={<span className="analysis-title"><FileTextOutlined /> 基本信息审查</span>}>
            <Descriptions 
              size="small" 
              column={2}
              colon={false}
              labelStyle={{ color: THEME.textMute }}
              contentStyle={{ color: THEME.text }}
            >
              {Object.entries(data.basic)
                .filter(([key]) => key !== '事件经过')
                .map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  <Text type={value === '未提及' ? 'secondary' : undefined}>
                    {value === '未提及' ? <Text type="danger">{value}</Text> : value}
                  </Text>
                </Descriptions.Item>
              ))}
            </Descriptions>
            <Alert
              type="info"
              message="事件经过"
              description={
                <Paragraph style={{ color: THEME.text }}>
                  {data.basic['事件经过'] || '未提及'}
                </Paragraph>
              }
              showIcon
              style={{ marginTop: 16, background: 'transparent', border: '1px solid rgba(91,160,255,0.25)' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card className="analysis-card" title={<span className="analysis-title"><SafetyCertificateOutlined /> 合规性检查</span>}>
            <List
              dataSource={data.complianceChecks}
              renderItem={(item) => <ComplianceCheckItem item={item} />}
            />
            <Divider className="analysis-divider" />
            <Title level={5} style={{ color: THEME.text }}>风险点摘要</Title>
            {data.risks.slice(0, 3).map((r, i) => (
              <span key={i} className={`analysis-risk-tag ${r.level === '高' ? 'high' : r.level === '中' ? 'mid' : 'low'}`}>
                {r.desc}
              </span>
            ))}
          </Card>
        </Col>
      </Row>

      {/* 词云与证据关联 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Card className="analysis-card" title={<span className="analysis-title"><Tag cloud>词云</Tag> 高频关键词</span>}>
            {data.keywords.length > 0 ? (
              <WordCloudChart data={data.keywords} />
            ) : (
              <Text type="secondary">暂无关键词数据</Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card className="analysis-card" title={<span className="analysis-title"><InfoCircleOutlined /> 证据关联图谱</span>}>
            {data.evidenceGraph.nodes.length > 0 ? (
              <EvidenceGraphChart 
                nodes={data.evidenceGraph.nodes}
                links={data.evidenceGraph.links}
                categories={data.evidenceGraph.categories}
              />
            ) : (
              <Text type="secondary">暂无证据关联数据</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 审查结论 */}
      <Card className="analysis-card" title={<span className="analysis-title"><SafetyCertificateOutlined /> 审查结论与建议</span>}>
        <Row gutter={24}>
          <Col span={12}>
            <Alert
              type={data.highRisk > 0 ? 'error' : data.midRisk > 0 ? 'warning' : 'success'}
              message="审查结论"
              description={<Paragraph style={{ color: THEME.text }}>{data.conclusion}</Paragraph>}
              showIcon
              icon={<SafetyCertificateOutlined />}
              style={{ background: 'transparent', border: '1px solid rgba(91,160,255,0.2)' }}
            />
          </Col>
          <Col span={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Badge status="error" text={<Text style={{ color: THEME.danger }}>高风险项: {data.highRisk}</Text>} />
              <Badge status="warning" text={<Text style={{ color: THEME.warning }}>中风险项: {data.midRisk}</Text>} />
              <Badge status="success" text={<Text style={{ color: THEME.success }}>低风险项: {data.lowRisk}</Text>} />
            </Space>
            <Divider className="analysis-divider" />
            <Title level={5} style={{ color: THEME.text }}>改进建议</Title>
            <List
              size="small"
              dataSource={data.advice}
              renderItem={(item, i) => (
                <List.Item className="analysis-advice-item" style={{ padding: '6px 0', borderBottom: 'none' }}>
                  <ArrowRightOutlined style={{ color: THEME.primary, marginRight: 8 }} />
                  <Text style={{ color: THEME.text }}>{item}</Text>
                </List.Item>
              )}
            />
          </Col>
        </Row>
      </Card>
      <Button className="analysis-back-btn" icon={<LeftOutlined />} onClick={() => window.location.href = './'}>返回卷宗</Button>
    </div>
  );
};

// 绑定到DOM
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  const urlParams = new URLSearchParams(window.location.search);
  const caseId = urlParams.get('case_id') || '';
  const caseName = decodeURIComponent(urlParams.get('name') || caseId);
  
  root.render(
    <AnalysisDashboard caseId={caseId} caseName={caseName} />
  );
}

export default AnalysisDashboard;
