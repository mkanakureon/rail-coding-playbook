# アセット管理画面 (my-assets) 新実装案

**作成日**: 2026-02-26
**対象**: `apps/next/app/(private)/my-assets/page.tsx` の完全置き換え

## 1. 刷新のポイント
- **脱インラインスタイル**: メンテナンス性の低い `style={{...}}` をすべて排除。
- **インタラクティブ性**: ホバーエフェクトやスムーズなタブ切り替え。
- **デザインの統一**: `mypage` と共通の赤〜オレンジのアクセントカラーを使用。

## 2. 実装コード (TSX)

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getUserAssets,
  uploadUserAsset,
  deleteUserAsset,
  importFromLibrary,
  getPublicOfficialAssets,
  getOfficialAssetSubcategories,
  getProjects,
  importOfficialAsset,
  resolveAssetUrl,
} from '@/lib/api';
import type { UserAssetItem, OfficialAsset, Project } from '@/lib/api';
import { Search, Upload, Plus, Trash2, Image as ImageIcon, Music, User, FileText } from 'lucide-react';

type Tab = 'official' | 'my';

const KIND_OPTIONS = [
  { value: '', label: 'すべて', icon: <FileText size={16} /> },
  { value: 'image', label: '画像', icon: <ImageIcon size={16} /> },
  { value: 'audio', label: '音声', icon: <Music size={16} /> },
  { value: 'ch-class', label: 'キャラクラス', icon: <User size={16} /> },
];

// ... (CATEGORY_MAP 等の定数は既存を維持)

export default function MyAssetsPage() {
  // ... (ステート管理ロジックは既存を継承しつつ整理)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">アセット管理</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">作品に使用する素材を管理・追加します</p>
        </div>
        
        {/* 検索バー */}
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="アセット名で検索..." 
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition"
          />
        </div>
      </header>

      {/* メインタブ切替 */}
      <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-8 w-fit">
        {([['official', '公式ライブラリ'], ['my', 'マイアセット']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition ${
              tab === key 
                ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* サイドバー：フィルター & アップロード */}
        <aside className="lg:col-span-1 space-y-6">
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">種別</h3>
            <div className="flex flex-col gap-2">
              {KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setKind(opt.value)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                    kind === opt.value 
                      ? 'bg-orange-500 text-white shadow-md' 
                      : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-orange-300'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {tab === 'my' && (
            <label className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition cursor-pointer overflow-hidden relative group">
              <Upload size={20} />
              <span>新規アップロード</span>
              <input type="file" className="hidden" onChange={handleUpload} />
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </label>
          )}
        </aside>

        {/* メイングリッド */}
        <main className="lg:col-span-3">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {assets.map((asset) => (
                <div key={asset.id} className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:shadow-2xl transition duration-300">
                  <div className="relative aspect-[16/10] bg-gray-50 dark:bg-black flex items-center justify-center overflow-hidden">
                    {/* サムネイル表示ロジック */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                       {/* クイックアクションボタン */}
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-sm truncate">{asset.displayName || asset.filename}</h4>
                    <p className="text-xs text-gray-400 mt-1 uppercase">{asset.kind} / {asset.category || '-'}</p>
                    
                    {/* プロジェクト追加用モダンセレクト */}
                    <div className="mt-4">
                      <select className="w-full bg-orange-50 dark:bg-orange-900/20 border-none text-orange-700 dark:text-orange-300 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="">+ プロジェクトに追加</option>
                        {/* プロジェクト一覧 */}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

---
*Next: `26-MYPAGE_ENHANCED_IMPLEMENTATION.md` にて、マイページの強化コード案を作成します。*
