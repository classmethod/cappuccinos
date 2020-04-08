# 準備
cappuccinos ルートディレクトリで、インストールし、ターミナルを再起動してください。

```
$ npm -g install
```

以下、本ディレクトリ以下のサンプルプロジェクトを利用します。

# プロジェクト設定
プロジェクトは複数の環境にデプロイできます。
環境（prd, stg, dev など）毎に設定ファイルを定義してください。

## 共通設定ファイル
`./conf/project.yaml` はプロジェクトの共通設定です。
すべての環境で共通する設定はここに記述してください。
各環境・関数毎の設定は、それぞれの設定ファイルで上書きされます。

## 環境設定ファイル
`./conf/{env_name}` ディレクトリを作成します。
`project.yaml` と `functions.yaml` を配置してください。

## AWS環境の設定
個人の環境に合わせ、 `./_aws.yaml` を修正し、 `./aws.yaml` として保存します（リポジトリにコミットしないこと）。
環境毎にAWS CLIで定義したプロファイルおよびにAWSアカウントIDを定義します。

```
---
dev:
  aws_profile: api-dev
  account_id: "9999999999999999"
stg:
  aws_profile: api-stg
  account_id: "9999999999999999"
prd:
  aws_profile: api-prd
  account_id: "9999999999999999"
```

# Lambda レイヤー
`shared_modules` レイヤーには、 `lambda-log` モジュールが定義されています。
以下のコマンドでレイヤーはデプロイされます。

```
$ cap layers deploy dev
[Deploy Layers]
AWS_PROFILE: api-dev
AWS_ACCOUNT_ID: 9999999999999999
REGION: ap-northeast-1
ENV: dev
  # cleanup
  # Build layer      layer=shared_modules
  # Layer published      layer=shared_modules,  version=1
```

# Lambda 関数
`functions` 以下にLambda関数を定義します。

Lambda関数は複数のディレクトリに配置され、ディレクトリ名がプレフィックスとなります。
例えば、 `./functions/api/hello` は、 `api_hello` 関数としてデプロイされます。


## デプロイ
初回ビルド（デプロイ）時は、tscなどがインストールされていないため、失敗するかも知れません。
`--rebuild` オプションを使うか、 各ディレクトリで `npm install` コマンドを実行してください。

```
$ cap functions deploy dev --rebuild
[Deployment Function]
AWS_PROFILE: api-dev
AWS_ACCOUNT_ID: 9999999999999999
REGION: ap-northeast-1
ENV: dev
  # cleanup
  # Build function     function=api_goodbye
  # Build function     function=api_hello
  # Function updated     function=api_hello
  # Function updated     function=api_goodbye
```

Lambda 関数 を指定し、デプロイすることも可能です。

```
$ cap functions deploy dev api_hello
[Deployment Function]
AWS_PROFILE: api-dev
AWS_ACCOUNT_ID: 9999999999999999
REGION: ap-northeast-1
ENV: dev
  # cleanup
  # Build function     function=api_hello
  # Function created     function=api_hello
```

## 実行
invoke コマンドを利用し、関数を実行できます。
実行時のパラメータは、  `event.test.json` に定義してください。

```
$ cap functions invoke dev api_hello
[Invoke Function]
AWS_PROFILE: api-dev
AWS_ACCOUNT_ID: 9999999999999999
REGION: ap-northeast-1
ENV: dev
>>>

name: World
<<<
Hello World.
```

