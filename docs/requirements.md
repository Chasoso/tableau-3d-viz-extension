# 要件・スコープ

## 目的

Tableau Viz Extensionとして、Tableauに接続した空間データを3Dで探索するための基盤を、仕様駆動で段階的に検証する。最初に、Viz Extension APIからShapefile由来のGeometryを取得・復元できるかを実機で確認する。

## MVP（計画）

- Tableauのワークシートに配置するViz Extension
- Polygon / MultiPolygonの押し出しによる2.5D表示
- `elevation` 相当の数値フィールドによる高さ指定（名称・選択方法は実装時に確定）
- 回転・ズーム・パン・リセットのカメラ操作
- Three.jsは候補レンダリングエンジンの一つとする
- 静的アセットは将来、HTTPSで配信する

MVPの実装開始条件は、Phase 0でGeometry取得経路を検証し、その結果に基づいて実現方式を決めることである。

## 非目標

- 本Issueでの3Dレンダラー、Viz Extension、`.trex`、AWS環境の実装
- DEMからの滑らかな地形生成
- Lambda、API Gateway、データベースなどのバックエンド
- TableauデータのS3や外部APIへの自動送信
- Geometryを取得できること、またはShapefileを読み込むだけで3D化できることの保証

## 未確定事項

Viz Extension APIのカスタムEncoding等を通じて、Geometryの型、座標、リング、穴、MultiPolygonの構造を欠落なく取得できるかは未検証である。取得できない場合は、GeoJSON等への事前変換を含む代替案を評価する。結果が出るまで、取得方式を確定しない。

## 受け入れ基準

- READMEと本書でMVPの対象・非対象が整合している。
- [SPEC-001](specifications/SPEC-001-geometry-retrieval.md) の手順を第三者が再現できる。
- 実機未実施の結果をPASSと扱わず、証跡と判定を記録できる。
- Phase 0の結果に基づき、直接取得・代替入力・継続調査のいずれかを判断できる。
- 本Issueの変更に3D機能の実装やGeometry取得可否の断定を含めない。
