module github.com/pocketsign/klon/examples/mini-app/backend

go 1.26.3

replace github.com/pocketsign/klon/sdk/go => ../../../sdk/go

replace github.com/pocketsign/klon/protobuf => ../../../protobuf

require (
	connectrpc.com/connect v1.20.0
	github.com/pocketsign/klon/protobuf v0.0.0
	github.com/pocketsign/klon/sdk/go v0.0.0-20260619092030-69716ba435eb
)

require (
	buf.build/gen/go/bufbuild/protovalidate/protocolbuffers/go v1.36.11-20260415201107-50325440f8f2.1 // indirect
	github.com/coreos/go-oidc/v3 v3.19.0 // indirect
	github.com/go-jose/go-jose/v4 v4.1.4 // indirect
	golang.org/x/oauth2 v0.36.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260618152121-87f3d3e198d3 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
)
