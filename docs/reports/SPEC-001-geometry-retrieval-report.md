# SPEC-001 Geometry取得検証レポート

> このファイルは記録用テンプレートです。実機証跡が揃うまで判定は `NOT VERIFIED` とします。

## 判定

- Status: `NOT VERIFIED`
- 実施日:
- 実施者:
- Tableau Desktop / OS:
- Tableau Extensions API / manifest min-api-version:

## 入力データ

- Fixture: `test-data/geometry-fixture.geojson`から生成したShapefile
- CRS: EPSG:4326
- Feature: `polygon-plain` / `polygon-hole` / `multipolygon`
- 属性: `id` / `elevation`
- 生成コマンド: `npm run fixture`

## API観測

| API / 項目 | 結果 | 証跡 |
| --- | --- | --- |
| `initializeAsync` | 未記入 | |
| `worksheetContent.worksheet` | 未記入 | |
| `getVisualSpecificationAsync` | 未記入 | |
| `getSummaryDataReaderAsync` | 未記入 | |
| `getUnderlyingTableDataReaderAsync` | 未記入 | |
| Geometry列の`dataType` | 未記入 | |
| Geometry値の型・返却値 | 未記入 | |
| `id`/`elevation`との対応 | 未記入 | |

## 構造照合

- 頂点座標の欠落・変換:
- 外輪リング:
- 穴リング:
- MultiPolygonの構造:
- 行数・順序・属性対応:
- 再実行時の差異:

## 判定根拠

- PASS / PARTIAL / FAIL / NOT VERIFIED:
- 根拠となるJSONまたはスクリーンショット:
- 例外・制約:
- 後続判断:
