'use client';
import { useApp } from '@/lib/auth-context';
export default function Footer(){const {t}=useApp();return <footer className="border-t border-stone-300 px-4 py-2 text-xs text-stone-600">{t('sim')}</footer>;}
