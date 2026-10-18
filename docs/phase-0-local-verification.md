# Phase 0 ローカル検証手順

## 公式仕様に基づく範囲

検証アプリは、Tableau公式のViz Extension APIと型定義にある次の経路だけを使用する。

- `tableau.extensions.initializeAsync()`
- `tableau.extensions.worksheetContent.worksheet`
- `worksheet.getVisualSpecificationAsync()`
- `worksheet.getSummaryDataReaderAsync()`
- `worksheet.getUnderlyingTablesAsync()`
- `worksheet.getUnderlyingTableDataReaderAsync()`
- `worksheet.getDataSourcesAsync()`

`Column.dataType` が `spatial` になるか、返却される `DataValue.value` / `nativeValue` がどの型・値になるかを表示する。値をGeometryオブジェクトと仮定した変換や3D描画は行わない。

参照した公式資料:

- [Viz Extension manifest](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_manifest/)
- [Create a Viz Extension](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_create/)
- [Getting data from the workbook](https://tableau.github.io/extensions-api/docs/core/trex_getdata/)
- [Accessing underlying data](https://tableau.github.io/extensions-api/docs/security/trex_data_access/)
- [Extensions API type definitions](https://www.npmjs.com/package/@tableau/extensions-api-types)

## ローカル準備

Node.js 18以上とnpmを用意し、リポジトリのルートで実行する。

```powershell
npm install
npm run build
npm run fixture
npm run serve
```

`npm run fixture` は `test-data/geometry-fixture.geojson` から、EPSG:4326のPolygon、穴ありPolygon、MultiPolygon、`id`、`elevation`を含む `test-data/generated/geometry-fixture.zip` を生成する。ZIPを展開してShapefile一式を使用する。生成物はGit管理対象外である。

## Tableau Desktopでの操作

1. Tableau Desktopで生成したShapefileの `.shp` を開く。
2. `id` と `elevation` を含むワークシートを作成する。Geometry列をMarksカードのDetailへ配置する。
3. MarksカードのMark TypeからViz ExtensionsのAdd Extensionを選択する。
4. Add an ExtensionでAccess Local Extensionsを選択し、`extension/geometry-diagnostic.trex`を開く。
5. 必要に応じて `id` と `elevation` を診断アプリのID/Elevationタイルへ配置する。GeometryはDetailに残す。
6. 診断画面で初期取得の完了を待ち、`summary`、`underlyingTables`、`visualSpecification`のJSONを保存する。Refresh diagnosticで再取得できる。
7. JSON内で、Geometryに対応する列の`dataType`、値の型、頂点・リング・穴・MultiPolygonの情報、`id`/`elevation`との対応を確認する。

## 判定と未検証事項

実機のJSON証跡がない状態は `NOT VERIFIED` とする。`spatial`列が表示されたことだけでは、頂点・リング・穴・MultiPolygonを完全に復元できたことを意味しない。完全性は、入力fixtureとの照合結果を [レポートテンプレート](reports/SPEC-001-geometry-retrieval-report.md) に記録してから判定する。

この環境ではTableau Desktopを操作できないため、本作業では実機結果を作成しない。
