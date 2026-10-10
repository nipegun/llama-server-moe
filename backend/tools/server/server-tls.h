#pragma once

#include <memory>
#include <string>

namespace httplib {
class Server;
}

// Use supplied PEM files or generate a self-signed identity for this process.
std::unique_ptr<httplib::Server> fCreateHttpsServer(const std::string &pHost,
                                                  const std::string &pCertificate,
                                                  const std::string &pKey);
