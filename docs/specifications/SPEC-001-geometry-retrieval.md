# SPEC-001: Geometry取得検証

## 目的

Tableau Viz Extension APIを使って、Shapefile由来のPolygon / MultiPolygonのGeometryを、頂点・リング・穴・属性との対応を保ったまま取得できるかを検証する。本仕様は取得可能性を前提にしない。

## 入力データ

小規模で再作成可能なテスト用Shapefileを用意する。最低限、次の形状と属性を含める。

- 穴なしPolygon
- 穴ありPolygon
- MultiPolygon
- 一意な `id`
- 数値の `elevation`

使用したファイルの作成方法、座標系、件数、属性定義、ハッシュまたは保管場所を検証記録に残す。実データや秘密情報はリポジトリへ追加しない。

## 実施手順

1. 対象のTableau Desktop、Tableauバージョン、Viz Extension APIバージョン、OSを記録する。
2. テスト用ShapefileをTableauに接続し、対象ワークシートを作成する。
3. 最小限のViz Extensionを配置し、利用可能なフィールド情報とデータ取得APIの応答を記録する。
4. 各形状について、Geometryの型、座標値、リング数、穴の有無、MultiPolygonの構造、`id`/`elevation`との対応を観察する。
5. 画面表示だけでなく、取得した値のログまたは再現可能なエクスポートを証跡として保存する。座標の省略や丸めがある場合は明記する。
6. 同じ手順を必要に応じて再実行し、結果が環境依存でないか確認する。

## 結果記録

結果記録には少なくとも次を含める。

- 実施日、実施者、環境情報
- 入力データの識別情報
- API・Encoding・フィールド指定方法
- 取得した値の要約と証跡へのリンク
- 欠落、変換、エラー、再現性の有無
- 判定（PASS / PARTIAL / FAIL / NOT VERIFIED）

## 判定基準

- **PASS**: 対象形状の座標、リング、穴、MultiPolygon構造、属性対応を、実装に必要な範囲で再現可能に取得できた。
- **PARTIAL**: 一部の形状または構造だけ取得できた。取得できない条件と代替案の評価が必要である。
- **FAIL**: 必要なGeometryを取得できない、または対応を再現できない。直接取得方式は採用せず、代替入力を評価する。
- **NOT VERIFIED**: 実機・必要環境が未準備、または完全性を示す証跡がなく、検証結果を確定できない。PASSの代わりにはしない。

判定は証跡に基づいて行う。Metadataが見えること、ShapefileをTableauで開けること、画面に地図が表示されることだけでは、Geometry取得のPASSとはしない。

Issue #3時点の実測記録は[検証レポート](../reports/SPEC-001-geometry-retrieval-report.md)に反映する。Geometry値の返却自体が確認できても、全頂点・リング・穴・MultiPolygonパートを機械的に照合できる証跡がない場合は`PARTIAL`とし、`PASS`にはしない。供給方式とIssue #4の責務境界は[ADR-001](../adr/ADR-001-geometry-supply.md)に記録する。
