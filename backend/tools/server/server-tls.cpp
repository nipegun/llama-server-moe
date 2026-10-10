#include "server-tls.h"
#include "server-common.h"

#include <cpp-httplib/httplib.h>

#ifdef CPPHTTPLIB_OPENSSL_SUPPORT
#include <openssl/ec.h>
#include <openssl/rand.h>
#include <openssl/x509v3.h>

static bool fAddCertificateExtension(X509 *pCertificate, int pId, const std::string &pValue) {
  std::unique_ptr<X509_EXTENSION, decltype(&X509_EXTENSION_free)> vExtension(
      X509V3_EXT_conf_nid(nullptr, nullptr, pId, pValue.c_str()), X509_EXTENSION_free);
  return vExtension && X509_add_ext(pCertificate, vExtension.get(), -1) == 1;
}

static bool fGenerateServerIdentity(SSL_CTX *pContext, const std::string &pHost) {
  std::unique_ptr<EVP_PKEY_CTX, decltype(&EVP_PKEY_CTX_free)> vGenerator(
      EVP_PKEY_CTX_new_id(EVP_PKEY_EC, nullptr), EVP_PKEY_CTX_free);
  if (!vGenerator || EVP_PKEY_keygen_init(vGenerator.get()) <= 0 ||
      EVP_PKEY_CTX_set_ec_paramgen_curve_nid(vGenerator.get(), NID_X9_62_prime256v1) <= 0) {
    return false;
  }
  EVP_PKEY *vRawKey = nullptr;
  const int vKeyStatus = EVP_PKEY_keygen(vGenerator.get(), &vRawKey);
  std::unique_ptr<EVP_PKEY, decltype(&EVP_PKEY_free)> vKey(vRawKey, EVP_PKEY_free);
  std::unique_ptr<X509, decltype(&X509_free)> vCertificate(X509_new(), X509_free);
  if (vKeyStatus <= 0 || !vKey || !vCertificate) {
    return false;
  }

  unsigned char aSerial[16];
  if (RAND_bytes(aSerial, sizeof(aSerial)) != 1) {
    return false;
  }
  std::unique_ptr<BIGNUM, decltype(&BN_free)> vSerial(BN_bin2bn(aSerial, sizeof(aSerial), nullptr), BN_free);
  if (!vSerial || !BN_to_ASN1_INTEGER(vSerial.get(), X509_get_serialNumber(vCertificate.get())) ||
      X509_set_version(vCertificate.get(), 2) != 1 ||
      !X509_gmtime_adj(X509_getm_notBefore(vCertificate.get()), -300) ||
      !X509_gmtime_adj(X509_getm_notAfter(vCertificate.get()), 365L * 24 * 60 * 60) ||
      X509_set_pubkey(vCertificate.get(), vKey.get()) != 1) {
    return false;
  }
  X509_NAME *vName = X509_get_subject_name(vCertificate.get());
  if (!vName || X509_NAME_add_entry_by_txt(vName, "CN", MBSTRING_ASC,
      reinterpret_cast<const unsigned char *>("moe-gguf-server"), -1, -1, 0) != 1 ||
      X509_set_issuer_name(vCertificate.get(), vName) != 1) {
    return false;
  }

  std::string vNames = "DNS:localhost,IP:127.0.0.1,IP:::1";
  if (!pHost.empty() && pHost != "0.0.0.0" && pHost != "::" &&
      pHost.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:") == std::string::npos) {
    std::unique_ptr<ASN1_OCTET_STRING, decltype(&ASN1_OCTET_STRING_free)> vIp(
        a2i_IPADDRESS(pHost.c_str()), ASN1_OCTET_STRING_free);
    if (vIp) {
      vNames += ",IP:" + pHost;
    } else if (pHost.find(':') == std::string::npos) {
      vNames += ",DNS:" + pHost;
    }
  }
  if (!fAddCertificateExtension(vCertificate.get(), NID_basic_constraints, "critical,CA:FALSE") ||
      !fAddCertificateExtension(vCertificate.get(), NID_key_usage, "critical,digitalSignature") ||
      !fAddCertificateExtension(vCertificate.get(), NID_ext_key_usage, "serverAuth") ||
      !fAddCertificateExtension(vCertificate.get(), NID_subject_alt_name, vNames) ||
      X509_sign(vCertificate.get(), vKey.get(), EVP_sha256()) <= 0) {
    return false;
  }
  return SSL_CTX_set_min_proto_version(pContext, TLS1_2_VERSION) == 1 &&
      SSL_CTX_use_certificate(pContext, vCertificate.get()) == 1 &&
      SSL_CTX_use_PrivateKey(pContext, vKey.get()) == 1 && SSL_CTX_check_private_key(pContext) == 1;
}
#endif

std::unique_ptr<httplib::Server> fCreateHttpsServer(const std::string &pHost,
                                                  const std::string &pCertificate,
                                                  const std::string &pKey) {
#ifdef CPPHTTPLIB_OPENSSL_SUPPORT
  if (!pCertificate.empty()) {
    return std::make_unique<httplib::SSLServer>(pCertificate.c_str(), pKey.c_str());
  }
  auto vServer = std::make_unique<httplib::SSLServer>([&pHost](httplib::tls::ctx_t pContext) {
    return fGenerateServerIdentity(static_cast<SSL_CTX *>(pContext), pHost);
  });
  if (vServer->is_valid()) {
    SRV_WRN("%s", "using a self-signed HTTPS certificate generated in memory for this run; browsers require a trust exception. "
        "Use --ssl-cert-file and --ssl-key-file for a persistent, trusted certificate.\n");
  }
  return vServer;
#else
  (void) pHost;
  (void) pCertificate;
  (void) pKey;
  SRV_ERR("%s", "HTTPS requires an OpenSSL-enabled build; rebuild with LLAMA_OPENSSL=ON or explicitly use --http.\n");
  return nullptr;
#endif
}
