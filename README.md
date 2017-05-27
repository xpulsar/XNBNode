## XNBNode
Command line utility to extract and pack XNB files.

## Compression
XNB files use a compression algorithm that is not easily available, this project uses a DLL that is probably proprietary for compression/decompression, and as such it was not included in the repository.
You can find the DLL [here](https://github.com/cpich3g/rpftool/blob/master/RPFTool/xcompress32.dll?raw=true).

## Usage
```
./node main.js extract input_dir output_dir
./node main.js extract input.xnb output.yaml

./node main.js pack input_dir output_dir
./node main.js pack input.yaml output.xml
```

