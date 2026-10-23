# ADR-001: Geometry供給方式の段階的な選択

- Status: Accepted for Issue #4 implementation boundary; product-wide adoption pending evidence
- Date: 2026-10-19
- Related: [SPEC-001 report](../reports/SPEC-001-geometry-retrieval-report.md), [Issue #3](https://github.com/Chasoso/tableau-3d-viz-extension/issues/3)

## Context

Tableau Desktopで、検証用Shapefileを接続したワークシートにGeometry Retrieval Diagnosticを配置した。3レコードの`id`値とGeometryの返却値が表示され、Geometry列は`dataType: "spatial"`として観察された。返却値は本環境では`GEOGRAPHY('POLYGON ...')`形式の文字列だった。

ただし、完全なJSON証跡と全頂点・リング・穴・MultiPolygonパートの機械的照合結果はリポジトリに保存されていない。したがって、任意のShapefileに対する完全復元を保証する`PASS`とは扱わない。

## Decision

Issue #4では、Tableau Viz Extension APIから返る値を第一候補の入力として扱う。直接取得を、GeoJSONアップロード等の別供給方式へ置き換える仕様変更は行わない。

ただし、次の条件付き設計とする。

1. Tableau APIの読み取りとGeometryの正規化・検証を`TableauGeometrySource`と`GeometryAdapter`の境界で分離する。
2. `GeometryAdapter`は、取得値を直ちにThree.jsへ渡さず、検証可能な中間表現へ変換する。
3. 返却値の文字列表現は今回の観察結果であり、公式の安定したGeometryシリアライズ契約とはみなさない。未知の型・形式・不正なリングは明示的なエラーにする。
4. fixtureの3形状について、頂点、外輪、穴、MultiPolygonパート、`id`/`elevation`の対応を照合できる証跡が揃うまで、製品としての「任意のShapefile対応」は未確定とする。

## Options considered

### A. Tableauからの直接取得（選択）

- ユーザー操作: TableauにShapefileを接続し、GeometryをMarksカードへ配置するだけ。
- 汎用性: 既存のTableauワークシートと属性フィールドを利用できる可能性がある。ただし、任意のGeometry形式・行数・制限は未検証。
- セキュリティ: 診断・描画処理をViz Extension内で完結でき、外部アップロードを要求しない。
- 制約: API返却値の形式、取得上限、複雑なGeometry、座標系、集約時の行対応を追加確認する必要がある。

### B. 事前変換データまたはGeoJSONアップロード

- 長所: 入力形式とGeometry中間表現をアプリ側で管理しやすい。
- 短所: TableauにShapefileを読み込むだけという当初要件から外れ、ユーザー操作、データ複製、サイズ制限、アップロード管理が増える。
- 判断: 現時点では採用しない。直接取得が実装上成立しない場合の代替案として記録する。

## Consequences

- Issue #4は、API取得、変換、描画を別責務として実装できる。
- 3Dレンダラーは中間表現だけを受け取り、Tableau APIやWKT風文字列を直接解釈しない。
- 完全なGeometry復元が確認できなければ、要件変更を人間承認に戻す。
- 公式API仕様にない返却値の仮定を、将来の互換性保証として文書化しない。

## Issue #4 interface contract

次のTypeScript相当の形を境界契約とする。実装はIssue #4で行う。

```ts
type Position = readonly [number, number];
type PolygonRings = readonly (readonly Position[])[];

type GeometryFeature = {
  id: string;
  geometry:
    | { type: 'Polygon'; rings: PolygonRings }
    | { type: 'MultiPolygon'; rings: readonly PolygonRings[] };
  elevation?: number;
};

interface TableauGeometrySource {
  read(): Promise<readonly unknown[]>;
}

interface GeometryAdapter {
  normalize(rows: readonly unknown[]): {
    features: readonly GeometryFeature[];
    warnings: readonly string[];
  };
}
```

`rings`はGeometry Adapterが検証した後の構造であり、レンダラーへ渡す時点では`coordinateSystem: 'local-meters'`とする。EPSG:4326からの局所メートル変換、欠損・負値の扱い、描画操作は[SPEC-002](../specifications/SPEC-002-3d-rendering.md)に定義する。これはThree.jsのAPIやTableauの生データ形式そのものではない。
