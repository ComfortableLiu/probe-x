fn main() -> Result<(), Box<dyn std::error::Error>> {
  std::env::set_var("PROTOC", protoc_bin_vendored::protoc_bin_path()?);
  let directory = "../../libs/shared-utils/src/lib/backend-common/proto";
  let proto = format!("{directory}/final_data_cleaning_control_bi_stream.proto");
  println!("cargo:rerun-if-changed={proto}");
  // The existing RPC is named Connect. Disable the transport convenience
  // constructor of the same name; connection.rs explicitly builds its Channel.
  tonic_build::configure()
    .build_server(true)
    .build_transport(false)
    .compile_protos(&[proto], &[directory])?;
  Ok(())
}
