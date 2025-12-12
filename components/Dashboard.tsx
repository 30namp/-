'use client';

import {
  Layout,
  Menu,
  Typography,
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  message,
  Form,
  InputNumber,
  Select
} from 'antd';
import { LogoutOutlined, LineChartOutlined, PlusCircleOutlined } from '@ant-design/icons';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PriceChart } from './PriceChart';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Dashboard({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tradeLoading, setTradeLoading] = useState(false);

  const { data: account, mutate: refreshAccount } = useSWR('/api/account', fetcher, {
    refreshInterval: 15000
  });
  const { data: positions, mutate: refreshPositions } = useSWR('/api/positions', fetcher, {
    refreshInterval: 15000
  });
  const { data: trades } = useSWR('/api/trades', fetcher, { refreshInterval: 20000 });
  const { data: market } = useSWR('/api/market', fetcher, { refreshInterval: 10000 });

  const onLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
  };

  const onDeposit = async (amount: number) => {
    const res = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'deposit', amount })
    });
    if (res.ok) {
      message.success('موجودی به‌روز شد');
      refreshAccount();
    }
  };

  const onWithdraw = async (amount: number) => {
    const res = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'withdraw', amount })
    });
    if (res.ok) {
      message.success('برداشت انجام شد');
      refreshAccount();
    } else {
      const data = await res.json();
      message.error(data.message || 'موجودی کافی نیست');
    }
  };

  const onOpenPosition = async (values: any) => {
    setTradeLoading(true);
    const res = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, symbol })
    });
    const data = await res.json();
    setTradeLoading(false);
    if (!res.ok) {
      message.error(data.message || 'خطا در ایجاد موقعیت');
      return;
    }
    message.success('موقعیت باز شد');
    refreshPositions();
    refreshAccount();
  };

  const onClose = async (id: number) => {
    const res = await fetch(`/api/positions/${id}/close`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      message.error(data.message || 'خطا در بستن موقعیت');
      return;
    }
    message.success('موقعیت بسته شد');
    refreshPositions();
    refreshAccount();
  };

  const positionColumns = [
    { title: 'نماد', dataIndex: 'symbol', key: 'symbol' },
    { title: 'جهت', dataIndex: 'side', key: 'side', render: (side: string) => <Tag color={side === 'long' ? 'green' : 'red'}>{side === 'long' ? 'لانگ' : 'شورت'}</Tag> },
    { title: 'حجم', dataIndex: 'size', key: 'size' },
    { title: 'قیمت ورود', dataIndex: 'entry_price', key: 'entry_price' },
    {
      title: 'حد ضرر / سود',
      key: 'limits',
      render: (_: any, record: any) => `${record.stop_loss || '-'} / ${record.take_profit || '-'}`
    },
    {
      title: 'عملیات',
      key: 'action',
      render: (_: any, record: any) => (
        <Button onClick={() => onClose(record.id)} danger>
          بستن
        </Button>
      )
    }
  ];

  const tradeColumns = [
    { title: 'نماد', dataIndex: 'symbol', key: 'symbol' },
    { title: 'جهت', dataIndex: 'side', key: 'side', render: (side: string) => <Tag color={side === 'long' ? 'green' : 'red'}>{side === 'long' ? 'لانگ' : 'شورت'}</Tag> },
    { title: 'حجم', dataIndex: 'size', key: 'size' },
    { title: 'ورود', dataIndex: 'entry_price', key: 'entry_price' },
    { title: 'خروج', dataIndex: 'exit_price', key: 'exit_price' },
    {
      title: 'سود/زیان',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (pnl: number) => <Tag color={pnl >= 0 ? 'green' : 'red'}>{pnl.toFixed(2)}</Tag>
    }
  ];

  const menuItems = useMemo(
    () => [
      { key: 'brand', label: 'سامانه معاملاتی مجازی' },
      { key: 'user', label: `${user.name} (${user.email})`, disabled: true },
      { key: 'logout', label: 'خروج', icon: <LogoutOutlined />, onClick: onLogout }
    ],
    [user]
  );

  return (
    <Layout>
      <Header style={{ background: '#fff', paddingInline: 0 }}>
        <Menu mode="horizontal" selectable={false} items={menuItems} style={{ justifyContent: 'flex-end' }} />
      </Header>
      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card>
              <Title level={3}>داشبورد معاملات</Title>
              <Paragraph>
                وضعیت حساب، موقعیت‌های باز، سابقه معاملات و دیده‌بان بازار در یک نگاه.
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="وضعیت حساب">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic title="موجودی" value={account?.balance ?? 0} suffix="ریال" precision={0} />
                </Col>
                <Col span={12}>
                  <Statistic title="ارزش روز" value={account?.equity ?? 0} suffix="ریال" precision={0} />
                </Col>
              </Row>
              <Space style={{ marginTop: 16 }} wrap>
                <Button onClick={() => onDeposit(5000000)}>واریز ۵ میلیون</Button>
                <Button onClick={() => onWithdraw(5000000)} danger>
                  برداشت ۵ میلیون
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="ایجاد موقعیت جدید" extra={<LineChartOutlined />}>
              <Form layout="vertical" onFinish={onOpenPosition} initialValues={{ side: 'long', size: 0.1 }}>
                <Form.Item label="نماد" required>
                  <Select value={symbol} onChange={setSymbol} options={(market || []).map((m: any) => ({ value: m.symbol, label: m.symbol }))} />
                </Form.Item>
                <Form.Item label="جهت معامله" name="side">
                  <Select
                    options={[
                      { value: 'long', label: 'لانگ' },
                      { value: 'short', label: 'شورت' }
                    ]}
                  />
                </Form.Item>
                <Form.Item label="حجم" name="size" rules={[{ required: true, message: 'حجم را مشخص کنید' }]}> 
                  <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="حد ضرر" name="stop_loss"> 
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="حد سود" name="take_profit"> 
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
                <Button type="primary" icon={<PlusCircleOutlined />} htmlType="submit" loading={tradeLoading} block>
                  باز کردن موقعیت
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} md={14}>
            <Card title="دیده‌بان بازار">
              <Table
                size="small"
                rowKey="symbol"
                dataSource={market || []}
                pagination={false}
                columns={[
                  { title: 'نماد', dataIndex: 'symbol' },
                  { title: 'قیمت', dataIndex: 'price' },
                  {
                    title: 'تغییر روزانه',
                    dataIndex: 'change',
                    render: (value: number) => <Tag color={value >= 0 ? 'green' : 'red'}>{value.toFixed(2)}%</Tag>
                  },
                  { title: 'حجم', dataIndex: 'volume' }
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} md={10}>
            <Card title="نمودار قیمت">
              <PriceChart symbol={symbol} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card title="موقعیت‌های باز">
              <Table rowKey="id" dataSource={positions || []} columns={positionColumns} pagination={false} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card title="سوابق معاملات">
              <Table rowKey="id" dataSource={trades || []} columns={tradeColumns} pagination={{ pageSize: 5 }} />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}
