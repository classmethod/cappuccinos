# Commands overview

|command|description|
|:---|:---|
|layers build \<env> [layer]              |Build layers.                      |
|layers deploy \<env> [layer]             |Deploy layers.                     |
|functions list                           |Display all functions.             |
|functions build \<env> [function]        |Build a specific function.         |
|functions delete \<env> [function]       |Delete a specific function.        |
|functions deploy \<env> [function]       |Deploy a specific function.        |
|functions invoke \<env> \<function>      |Invoke a specific function.        |
|functions publish \<env> [function]      |Publish function.                  |
|logs functions \<env> [function]         |create or update CloudWatch Log Group for Lambda functions.|
|logs subscription \<env> [function]      |subscribe log handler.             |
|api doc \<env> [api]                     |Make APIs document                 |
|api deploy \<env>                        |Deploy APIs                        |
|api stage \<env>                         |Apply APIs to stage                |
|websockets deploy \<env>                 |Deploy WebSocket APIs              |
|websockets stage \<env>                  |Apply WebSocket APIs to stage      |
|stepfunctions deploy <env> [name]        |Deploy Step Functions              |                           
|stepfunctions invoke <env> <name>        |Invoke a specific step function.   |

# Requirements

- node.js 
- spectacle-docs (optional, node module)

# Install

```
$ npm -g install
```

インストール後、ターミナルを再起動してください。

```
$ cap --help
```

## spectacle-docs (optional)

API ドキュメントの作成を行う場合（api docコマンド）、ドキュメント生成ツールが必要です。

```
$ npm install -g spectacle-docs
```

# プロジェクト構成

## プロジェクト設定
プロジェクトは複数の環境にデプロイできます。
環境（prd, stg, dev など）毎に設定ファイルを定義してください。

### 共通設定ファイル
`./conf/project.yaml` はプロジェクトの共通設定です。
すべての環境で共通する設定はここに記述してください。
各環境・関数毎の設定は、それぞれの設定ファイルで上書きされます。

### 環境設定ファイル
`./conf/{env_name}` ディレクトリを作成します。
`project.yaml` と `functions.yaml` を配置してください。

### AWS環境の設定
個人の環境に合わせ、 `./conf/{env_name}/_aws.yaml` を修正し、 `./conf/{env_name}/aws.yaml` として保存します（リポジトリにコミットしないこと）。
環境毎にAWS CLIで定義したプロファイルおよびにAWSアカウントIDを定義します。

```
---
aws_profile: api-dev
account_id: "9999999999999999"
region: ap-northeast-1
```

## レイヤー
複数のLambda関数で横断的に利用するモジュールは、Lambda レイヤーを利用すると便利です。
各Lambda関数のサイズが小さくなるため、デプロイが高速化されます。

ただし、利用しないモジュールもレイヤーに含まれている場合、コールドスタート時に無駄なコストがかかります。
一部のLambda関数で利用する大きなモジュールは、レイヤーを分割してください。


