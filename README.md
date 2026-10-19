# Tableau 3D Viz Extension

A work-in-progress [Tableau Viz Extension](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_overview/) for interactively exploring spatial data in 3D.

Tableauで読み込んだ空間データを、ワークシート上で回転・ズーム・パンできる3Dマップとして表示することを目指すプロジェクトです。生成AIを**開発に活用**して、Tableau標準では難しい表現を追加できることを示します。拡張機能にAI機能を組み込むことは目的ではありません。

> **Status: Planning / Technical feasibility investigation**  
> 現在は構想・技術検証段階です。ShapefileのGeometryをViz Extension API経由で復元できるかは**未検証**であり、Shapefileを読み込むだけで3D化できることは、まだ保証されていません。

## Goal

- Tableauに接続した**任意のShapefile**に含まれるPolygon / MultiPolygonを、可能な限り追加のデータ変換なしで3D表示する。
- TableauのViz Extensionとしてワークシートに配置し、通常のダッシュボードにも組み込めるようにする。
- マウス操作で視点を自由に変え、地形や空間データを直感的に探索する。
- 特定の地域やデータセットに依存しない汎用的な実装とする。

## Planned MVP

| Setting | Initial value |
| --- | --- |
| Extension type | Tableau Viz Extension (worksheet) |
| Geometry | Polygon / MultiPolygon |
| Height field | `elevation` (user-configurable) |
| Height exaggeration | `2.0×` |
| Rendering | Extrusion (`extrude`) |
| Camera controls | Rotate / zoom / pan / reset |
| Rendering engine | Three.js (candidate) |
| Hosting | Amazon S3 + CloudFront (HTTPS static hosting) |

高さは数値フィールドから設定します。地理座標をメートル系の描画座標へ変換し、水平・垂直方向の単位を揃えたうえで高さの強調倍率を適用する想定です。単純なポリゴン押し出し（2.5D）がMVPの対象であり、DEMからの滑らかな地形復元は対象外です。

## Main technical risk: accessing Geometry

TableauでShapefileを開けることと、Viz Extensionが**Polygonの頂点・リング・穴情報を取得できること**は同義ではありません。Viz ExtensionのカスタムEncodingでは空間型をそのまま扱えると仮定しません。

開発の最初の段階では、実機のTableau Desktopで次を検証します。

1. Polygon / MultiPolygon、穴のあるPolygon、および`id`/`elevation`属性を持つ小さなShapefileを読み込む。
2. 最小限のViz Extensionからフィールド情報とデータ取得APIを調べる。
3. Geometryの型・取得値を観察し、頂点・リング構造を**欠落なく復元できるか**確認する。
4. **PASS:** 座標を復元できる場合はTableauからの直接取得方式を進める。
5. **PARTIAL / FAIL:** 復元できない場合は、GeoJSON等への事前変換や別途データ供給を代替案として評価する。元の「Shapefileを読み込むだけ」という要件を満たしたとは扱わない。

調査結果が出るまで、Geometryの取得方式は確定しません。

## Planned architecture

```text
Tableau Desktop / Tableau worksheet
  └── Viz Extension (.trex)
       └── Static web application (HTML / CSS / JavaScript)
            ├── Tableau Viz Extensions API
            ├── Geometry adapter (subject to feasibility validation)
            └── Three.js 3D renderer

CloudFront (HTTPS)
  └── Private S3 bucket (static assets)
```

AWSは静的アセットの配信にのみ使用する予定です。Lambda、API Gateway、DBはMVPでは不要です。TableauのデータをS3へ自動アップロードしたり、外部APIへ送信したりしない設計とします。

## Roadmap

| Phase | Scope | Exit condition |
| --- | --- | --- |
| 0 — Feasibility | Minimal Viz Extension + Shapefile Geometry retrieval test | API挙動の記録とPASS/PARTIAL/FAIL判定 |
| 1 — 3D renderer | Polygon extrusion, camera controls, field-driven height | 複数のテストポリゴンが正しく描画・操作できる |
| 2 — Tableau integration | Data binding, field selection, re-rendering | Tableau内のデータ変更へ追従する |
| 3 — Deployment | S3 + CloudFront hosting, `.trex` distribution | HTTPS配信したViz ExtensionがTableauで動作する |

各Phaseは前段の検証結果に応じて見直します。

## Development status

実装・インストール手順・デモ環境は今後追加します。現段階では完成済みの拡張機能や動作保証はありません。

## Project documentation

- [Requirements and scope](docs/requirements.md) — MVP、非目標、受け入れ基準
- [Architecture](docs/architecture.md) — 現時点の候補構成と未決定事項
- [Development workflow](docs/development-workflow.md) — IssueからPRまでの作業手順
- [Phase 0 Geometry retrieval specification](docs/specifications/SPEC-001-geometry-retrieval.md) — 実機検証の手順と判定基準
- [Phase 0 local verification](docs/phase-0-local-verification.md) — 診断拡張のビルド・fixture生成・Tableau Desktop操作
- [SPEC-001 report template](docs/reports/SPEC-001-geometry-retrieval-report.md) — 実機証跡と判定の記録用テンプレート
- [ADR-001 Geometry supply](docs/adr/ADR-001-geometry-supply.md) — 直接取得を第一候補とする条件付き設計判断
- [Repository development rules](AGENTS.md) — 作業ツリー、検証、コミット、PRのルール

## References

- [Tableau Viz Extensions overview](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_overview/)
- [Create a Viz Extension](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_create/)
- [Viz Extension manifest](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_manifest/)
- [Tableau spatial files](https://help.tableau.com/current/pro/desktop/en-us/maps_shapefiles.htm)
- [Three.js](https://threejs.org/)
