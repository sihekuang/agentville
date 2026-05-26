class Agentville < Formula
  desc "Real-time visualization dashboard for AI coding agents"
  homepage "https://github.com/sihekuang/agentville"
  url "https://github.com/sihekuang/agentville/archive/refs/tags/v0.5.0.tar.gz"
  sha256 "" # populated during release
  license "MIT"

  depends_on "node@22"

  def install
    system "npm", "install", "--ignore-scripts"
    system "npm", "run", "build"

    # Install the standalone build
    libexec.install Dir[".next/standalone/*"]

    # Next.js standalone requires .next/static and public/ to be copied in
    (libexec/".next/static").install Dir[".next/static/*"]
    libexec.install "public"

    # Create the launcher script
    (bin/"agentville").write <<~BASH
      #!/usr/bin/env bash
      set -euo pipefail
      AGENTVILLE_PORT="${AGENTVILLE_PORT:-4200}"
      export PORT="$AGENTVILLE_PORT"
      echo "Starting AgentVille on http://localhost:${AGENTVILLE_PORT}"
      exec "#{Formula["node@22"].opt_bin}/node" "#{libexec}/server.js"
    BASH

    # Write default env file
    (etc/"agentville").mkpath
    (etc/"agentville/config").write <<~EOS
      # AgentVille Configuration
      # Default port (avoids conflict with common port 3000)
      AGENTVILLE_PORT=4200
    EOS
  end

  def caveats
    <<~EOS
      AgentVille runs on port 4200 by default (not 3000) to avoid conflicts.

      To change the port:
        AGENTVILLE_PORT=8080 agentville

      Or edit the config:
        #{etc}/agentville/config
    EOS
  end

  service do
    run [opt_bin/"agentville"]
    environment_variables PORT: "4200"
    keep_alive true
    log_path var/"log/agentville.log"
    error_log_path var/"log/agentville-error.log"
  end

  test do
    port = free_port
    fork do
      ENV["PORT"] = port.to_s
      exec bin/"agentville"
    end
    sleep 5
    assert_match "AgentVille", shell_output("curl -s http://localhost:#{port}")
  end
end
