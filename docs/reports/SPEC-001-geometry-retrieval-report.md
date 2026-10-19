# SPEC-001 Geometry取得検証レポート

> このファイルは記録用テンプレートです。証跡の範囲に応じて `PASS` / `PARTIAL` / `FAIL` / `NOT VERIFIED` を記録します。

## 判定

- Status: `PARTIAL`
- 実施日: 2026-10-19（実機報告日）
- 実施者: リポジトリ管理者によるTableau Desktop実機確認
- Tableau Desktop / OS: 未記録
- Tableau Extensions API / manifest min-api-version: manifestは`1.17.0`。Desktop側の実行バージョンは未記録

`Geometry Retrieval Diagnostic`の画面で、fixtureの3レコードについて`id`の`value`（`polygon-plain`、`polygon-hole`、`multipolygon`）とGeometryの返却値が表示された。Geometry列は`dataType: "spatial"`で、表示された値は`GEOGRAPHY('POLYGON ...')`形式の文字列だった。これはGeometry値が返ることの実測証跡である。

一方、完全な診断JSON、Tableau Desktop/OS/APIのバージョン、3形状それぞれの全頂点・リング・穴・MultiPolygonパートの機械的な照合結果はリポジトリに保存されていない。そのため、SPEC-001の完全な`PASS`にはしない。

## 入力データ

- Fixture: `test-data/geometry-fixture.geojson`から生成したShapefile
- CRS: EPSG:4326
- Feature: `polygon-plain` / `polygon-hole` / `multipolygon`
- 属性: `id` / `elevation`
- 生成コマンド: `npm run fixture`

## API観測

| API / 項目 | 結果 | 証跡 |
| --- | --- | --- |
| `initializeAsync` | 画面が初期化完了し診断結果を表示 | Tableau画面報告 |
| `worksheetContent.worksheet` | 対象ワークシートで診断UIを実行 | Tableau画面報告 |
| `getVisualSpecificationAsync` | 完全な応答は未保存 | 未検証 |
| `getSummaryDataReaderAsync` | 列とサンプル値を表示 | Tableau画面報告 |
| `getUnderlyingTableDataReaderAsync` | 完全な応答は未保存 | 未検証 |
| Geometry列の`dataType` | `spatial` | Tableau画面報告 |
| Geometry値の型・返却値 | `string`、`GEOGRAPHY('POLYGON ...')`形式を観察 | Tableau画面報告 |
| `id`/`elevation`との対応 | `id`の3値を観察。全行の`elevation`対応は未保存 | Tableau画面報告 / 未検証 |

## 構造照合

- 頂点座標の欠落・変換: Geometry文字列に座標列が含まれることは観察。全頂点の照合は未実施。
- 外輪リング: fixtureの単純Polygonに対応する値の表示は観察。完全照合は未実施。
- 穴リング: 穴ありPolygonの値が返ることは実機画面で確認対象に含めたが、保存JSONによるリング数照合は未実施。
- MultiPolygonの構造: `multipolygon`のGeometry値が返ることは確認対象に含めたが、全パートの機械的照合は未実施。
- 行数・順序・属性対応: `id`の3値を観察。Geometry・`elevation`との完全な行対応は未保存。
- 再実行時の差異: 未検証。

## 判定根拠

- 判定: `PARTIAL`
- 根拠: [Issue #3](https://github.com/Chasoso/tableau-3d-viz-extension/issues/3)対応時に実施者が提供したTableau Desktop画面。完全JSONは未添付。
- 例外・制約: 返却値は本検証環境では文字列として観察された。Viz Extension APIが全てのGeometryを同じ文字列表現で返すこと、文字列表現が将来も安定すること、任意のShapefileで同じ結果になることは確認していない。
- 後続判断: 次のIssue #4では、Tableauの返却値を受け取る入力境界と変換責務を分離したGeometry adapterを実装し、fixture 3形状の完全JSON照合を実装前提の受け入れテストとする。直接取得方式は第一候補として継続するが、製品仕様としての全面採用は追加証跡と人間承認後に判断する。
