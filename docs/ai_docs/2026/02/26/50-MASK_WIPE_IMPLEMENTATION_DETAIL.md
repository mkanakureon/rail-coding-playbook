# マスクワイプ：GLSL 実装詳細仕様

**作成日**: 2026-02-26
**対象**: レンダリングエンジン開発
**核心**: SDL2 テクスチャを OpenGL シェーダーで合成する技術

## 1. シェーダーロジック (Fragment Shader)
マスク画像の R チャンネル（輝度）を取得し、`progress` パラメータと比較します。

```glsl
uniform sampler2D u_tex_from; // 遷移前の画像
uniform sampler2D u_tex_to;   // 遷移後の画像
uniform sampler2D u_mask;     // ルール画像 (マスク)
uniform float u_progress;     // 0.0 -> 1.0

void main() {
    float mask_val = texture(u_mask, TexCoord).r;
    // 境界を少しぼかすための閾値計算
    float alpha = smoothstep(u_progress - 0.1, u_progress, mask_val);
    vec4 col_from = texture(u_tex_from, TexCoord);
    vec4 col_to = texture(u_tex_to, TexCoord);
    FragColor = mix(col_to, col_from, alpha);
}
```

## 2. SDL2 と OpenGL の繋ぎ込み
`SDL_Renderer` は抽象化されているため、シェーダーを適用するには以下の手順が必要です。

1.  **テクスチャのバインド**: `SDL_GL_BindTexture` を使用して、SDL_Texture の内部的な OpenGL ID を取得し、GL_TEXTURE0〜2 に割り当てます。
2.  **描画のフラッシュ**: `SDL_RenderFlush` を呼び出し、SDL 側の描画命令を一旦完了させます。
3.  **クワッド描画**: 画面全体を覆う頂点データ（VBO）を用意し、シェーダーを使用して描画します。
4.  **復元**: シェーダーを unuse し、残りの UI 描画を `SDL_Renderer` に戻します。

## 3. アセット管理
マスク画像（ルール画像）も `AssetProvider` を通じて `slug` で管理します。
例：`bg("forest", "wipe:shutter", 1000)` -> `shutter` という slug のマスク画像を使用。

---
*Created by Gemini CLI Graphics Specialist.*
