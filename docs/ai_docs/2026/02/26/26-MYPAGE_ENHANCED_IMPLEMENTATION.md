# マイページ (mypage) 強化実装案

**作成日**: 2026-02-26
**対象**: `apps/next/app/(private)/mypage/page.tsx` の強化

## 1. 強化のポイント
- **AI 連携の可視化**: `GenerationResult` テーブルの状態をフェッチし、各プロジェクトの AI 執筆ステージを表示。
- **レイアウトの統合**: 統計行をヘッダーの「浮かぶカード」として再構成。
- **ナビゲーションの改善**: プロジェクトごとの「エディタで開く」「プレビュー」ボタンをカードに配置。

## 2. 実装コード (TSX)

```tsx
'use client';

// ... (既存のインポートに Lucide アイコンを追加)
import { Folder, User, MessageCircle, LogOut, Settings, Play, Edit3, Sparkles } from 'lucide-react';

export default function MyPage() {
  // ... (既存のステート管理)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* 強化されたヘッダーバナー */}
      <section className="relative pt-12 pb-24 overflow-hidden bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 text-white">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-400/20 rounded-full blur-3xl -ml-10 -mb-10" />
        </div>

        <div className="relative container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-4xl font-black shadow-2xl border border-white/30 rotate-3">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter mb-1">
                  {user?.username || '...'}
                </h1>
                <div className="flex items-center gap-3 text-white/80">
                  <span className="text-sm font-medium">{user?.email}</span>
                  <span className="w-1 h-1 bg-white/40 rounded-full" />
                  <span className="text-xs uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded">Free Plan</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/mypage/messages" className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 transition font-bold text-sm">
                <MessageCircle size={18} />
                <span>メッセージ</span>
                {unreadCount > 0 && <span className="bg-red-500 px-1.5 py-0.5 rounded-full text-[10px]">{unreadCount}</span>}
              </Link>
              <button onClick={handleLogout} className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl hover:bg-red-500 transition">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 浮かぶ統計カード (Floating Stats) */}
      <div className="container mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'プロジェクト', val: projects.length, icon: <Folder className="text-blue-500" /> },
            { label: '総プレイ数', val: workStats?.totalPlayCount || 0, icon: <Play className="text-green-500" /> },
            { label: 'いいね', val: workStats?.totalLikeCount || 0, icon: <Sparkles className="text-yellow-500" /> },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">{s.val}</p>
              </div>
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                {s.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8 border-b border-gray-200 dark:border-gray-800 pb-4">
          <button className="px-4 py-2 text-orange-600 border-b-2 border-orange-600 font-bold">マイプロジェクト</button>
          <button className="px-4 py-2 text-gray-400 hover:text-gray-600 transition">プロフィール設定</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((p) => (
            <div key={p.id} className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-2xl transition duration-300 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📁
                </div>
                {/* AI 進捗バッジ */}
                <div className="flex flex-col items-end gap-1">
                  <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded uppercase tracking-tighter flex items-center gap-1">
                    <Sparkles size={10} /> AI: Stage 3 完了
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">最終更新: {formatDate(p.updatedAt)}</span>
                </div>
              </div>
              
              <h3 className="text-xl font-bold mb-6 group-hover:text-orange-600 transition">{p.title}</h3>
              
              <div className="flex gap-2">
                <a href={`http://localhost:5176/projects/editor/${p.id}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-80 transition">
                  <Edit3 size={16} /> 制作を続ける
                </a>
                <Link href={`/preview/${p.id}`} className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <Play size={16} className="text-gray-600 dark:text-gray-400" />
                </Link>
              </div>
            </div>
          ))}
          
          {/* 新規作成カード */}
          <button onClick={() => setShowCreateDialog(true)} className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-orange-300 hover:text-orange-500 transition group">
            <div className="w-12 h-12 rounded-full border-2 border-current flex items-center justify-center group-hover:bg-orange-50 transition">
              <Plus size={24} />
            </div>
            <span className="font-bold">新しいプロジェクトを始める</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

---
*Created by Gemini CLI UI/UX Strategist.*
