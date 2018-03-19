# ScreepsPlus hosted agent

# Usage

To add an agent:
```http
POST /agent

{
	"method": "console" // See methods below
	"methodConfig": {
		// See options below
	},
	"screepsToken": "<TOKEN>",
	"screepsPlusToken": "<TOKEN>",
}
```

To delete an agent:
```http
DELETE /agent/:pk
```

To get current agents:
```http
GET /agent?token=SCREEPSPLUS_TOKEN
```

# Methods and options

## console

`shard` used to filter by shard, defaults to all shards

## memory

* `shard` [`shard0`] Shard to pull from
* `path` [`stats`] Path if using Memory
* `segment` Segment number if using segments
* `interval` [`60`] Interval in seconds to pull at, 
	defaults to 60. If pulling from segments, you can set this as low as 15
	If pulling from multiple shards, multiply this by the number of shards to stay within rate-limits.