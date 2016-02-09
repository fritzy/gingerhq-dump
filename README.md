# gingerhq-dump

Dumps your gingerhq.com posts and threads as markdown files with yaml headers.

## Install

`npm i -g gingerhq-dump`

## Usage

`gingerhq-dump --token "token" [--dir "out"] [--user "nick"] [--noheader] [--nosubdirs]`

`--token`: Get your token from [https://gingerhq.com/accounts/api-access/](https://gingerhq.com/accounts/api-access/)


`--dir`: directory to dump files

`--user`: Only include this user's posts

`--noheader`: Don't include yaml headers in markdown files

`--nosubdirs`: Don't create year/month/day sub directories

---

Licensed MIT, Copyright 2016 Nathanael C. Fritz
