# アーキテクチャ

## Phase 0/Issue #3時点の構成

```text
Tableau Desktop / worksheet
  └─ Viz Extension manifest (.trex)
       └─ Static web application
            ├─ Tableau Viz Extensions API adapter
            ├─ TableauGeometrySource (Tableau APIの読取)
            ├─ GeometryAdapter (検証可能な中間表現への変換)
            └─ 3D renderer (Three.js等の候補)
```

Geometryの返却値を直接レンダラーへ渡さず、Tableau APIの読取、Geometry変換、3D描画を分離する。供給方式の判断記録は[ADR-001](adr/ADR-001-geometry-supply.md)を参照する。

静的アセットの配信先としてS3 + CloudFrontを候補とする。ただし、実装・AWSリソース作成・配信方式は本Issueの対象外である。

## 条件付き決定事項

- TableauからGeometry値が返ることはfixtureで観察できたため、Issue #4では直接取得を第一候補とする。
- ただし、完全な頂点・リング・穴・MultiPolygon構造の復元、任意のShapefileへの適用、返却値形式の安定性は未確定である。
- 直接取得が要件を満たさない場合の入力形式（事前変換、別のデータ供給方法など）は代替案として残す。
- Geometryの座標系から描画座標への変換方法
- レンダリングライブラリとバンドル方式
- 配信・権限・CSPを含む本番運用構成

完全性を確認するまで、元の「任意のShapefileをTableauに読み込むだけ」という要件を変更しない。未確定事項は追加の証跡と人間レビューを経て判断する。
