'use client';

import { Tabs, Form, Input, Button, Typography, message } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const { Title, Paragraph } = Typography;

export function AuthPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any, endpoint: 'login' | 'register') => {
    setLoading(true);
    const res = await fetch(`/api/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      message.error(data.message || 'خطایی رخ داد');
      return;
    }
    message.success(data.message || 'انجام شد');
    router.refresh();
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px' }}>
      <Title level={2} style={{ textAlign: 'center' }}>
        سامانه معاملاتی مجازی
      </Title>
      <Paragraph style={{ textAlign: 'center' }}>
        برای شروع تمرین معاملات، یک حساب کاربری بسازید یا وارد شوید.
      </Paragraph>
      <Tabs
        defaultActiveKey="login"
        items={[
          {
            key: 'login',
            label: 'ورود',
            children: (
              <Form layout="vertical" onFinish={(values) => handleSubmit(values, 'login')}>
                <Form.Item label="ایمیل" name="email" rules={[{ required: true, message: 'ایمیل را وارد کنید' }]}>
                  <Input placeholder="user@example.com" />
                </Form.Item>
                <Form.Item label="رمز عبور" name="password" rules={[{ required: true, message: 'رمز عبور را وارد کنید' }]}>
                  <Input.Password />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  ورود
                </Button>
              </Form>
            )
          },
          {
            key: 'register',
            label: 'ثبت‌نام',
            children: (
              <Form layout="vertical" onFinish={(values) => handleSubmit(values, 'register')}>
                <Form.Item label="نام و نام خانوادگی" name="name" rules={[{ required: true, message: 'نام را وارد کنید' }]}>
                  <Input placeholder="نام کامل" />
                </Form.Item>
                <Form.Item label="ایمیل" name="email" rules={[{ required: true, type: 'email', message: 'ایمیل معتبر وارد کنید' }]}>
                  <Input placeholder="user@example.com" />
                </Form.Item>
                <Form.Item label="رمز عبور" name="password" rules={[{ required: true, min: 6, message: 'حداقل ۶ کاراکتر' }]}>
                  <Input.Password />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  ساخت حساب
                </Button>
              </Form>
            )
          }
        ]}
      />
    </div>
  );
}
