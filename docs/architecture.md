# アーキテクチャ（候補）

## 現時点の候補

```text
Tableau Desktop / worksheet
  └─ Viz Extension manifest (.trex)
       └─ Static web application
            ├─ Tableau Viz Extensions API adapter
            ├─ Geometry adapter (Phase 0の結果に依存)
            └─ 3D renderer (Three.js等の候補)
```

静的アセットの配信先としてS3 + CloudFrontを候補とする。ただし、実装・AWSリソース作成・配信方式は本Issueの対象外である。

## 未決定事項

- GeometryをViz Extension APIから直接取得できるか
- 取得できない場合の入力形式（事前変換、別のデータ供給方法など）
- Geometryの座標系から描画座標への変換方法
- レンダリングライブラリとバンドル方式
- 配信・権限・CSPを含む本番運用構成

これらはPhase 0の実測結果と、後続Issueの要件を根拠に決定する。候補構成を確定アーキテクチャとして扱わない。
