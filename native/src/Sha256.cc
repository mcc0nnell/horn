#include "Sha256.h"

#include <array>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <vector>

namespace horn::detail {
namespace {

constexpr std::array<std::uint32_t, 8> INITIAL{
    0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U, 0xa54ff53aU,
    0x510e527fU, 0x9b05688cU, 0x1f83d9abU, 0x5be0cd19U,
};

constexpr std::array<std::uint32_t, 64> K{
    0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U,
    0x3956c25bU, 0x59f111f1U, 0x923f82a4U, 0xab1c5ed5U,
    0xd807aa98U, 0x12835b01U, 0x243185beU, 0x550c7dc3U,
    0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U, 0xc19bf174U,
    0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU,
    0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU,
    0x983e5152U, 0xa831c66dU, 0xb00327c8U, 0xbf597fc7U,
    0xc6e00bf3U, 0xd5a79147U, 0x06ca6351U, 0x14292967U,
    0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU, 0x53380d13U,
    0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U,
    0xa2bfe8a1U, 0xa81a664bU, 0xc24b8b70U, 0xc76c51a3U,
    0xd192e819U, 0xd6990624U, 0xf40e3585U, 0x106aa070U,
    0x19a4c116U, 0x1e376c08U, 0x2748774cU, 0x34b0bcb5U,
    0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU, 0x682e6ff3U,
    0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
    0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U,
};

constexpr std::uint32_t rotateRight(std::uint32_t value, unsigned bits) noexcept {
    return (value >> bits) | (value << (32U - bits));
}

} // namespace

std::string sha256Hex(std::string_view value) {
    std::vector<std::uint8_t> message;
    message.reserve(value.size() + 72U);
    for (const unsigned char ch : value) {
        message.push_back(static_cast<std::uint8_t>(ch));
    }

    const std::uint64_t bitLength = static_cast<std::uint64_t>(message.size()) * 8U;
    message.push_back(0x80U);
    while ((message.size() % 64U) != 56U) {
        message.push_back(0U);
    }
    for (int shift = 56; shift >= 0; shift -= 8) {
        message.push_back(static_cast<std::uint8_t>((bitLength >> shift) & 0xffU));
    }

    auto state = INITIAL;
    std::array<std::uint32_t, 64> schedule{};

    for (std::size_t offset = 0; offset < message.size(); offset += 64U) {
        for (std::size_t index = 0; index < 16U; ++index) {
            const std::size_t base = offset + index * 4U;
            schedule[index] =
                (static_cast<std::uint32_t>(message[base]) << 24U) |
                (static_cast<std::uint32_t>(message[base + 1U]) << 16U) |
                (static_cast<std::uint32_t>(message[base + 2U]) << 8U) |
                static_cast<std::uint32_t>(message[base + 3U]);
        }

        for (std::size_t index = 16; index < 64U; ++index) {
            const auto x = schedule[index - 15U];
            const auto y = schedule[index - 2U];
            const auto sigma0 = rotateRight(x, 7U) ^ rotateRight(x, 18U) ^ (x >> 3U);
            const auto sigma1 = rotateRight(y, 17U) ^ rotateRight(y, 19U) ^ (y >> 10U);
            schedule[index] = schedule[index - 16U] + sigma0 +
                              schedule[index - 7U] + sigma1;
        }

        auto a = state[0];
        auto b = state[1];
        auto c = state[2];
        auto d = state[3];
        auto e = state[4];
        auto f = state[5];
        auto g = state[6];
        auto h = state[7];

        for (std::size_t index = 0; index < 64U; ++index) {
            const auto sum1 = rotateRight(e, 6U) ^ rotateRight(e, 11U) ^ rotateRight(e, 25U);
            const auto choice = (e & f) ^ (~e & g);
            const auto temp1 = h + sum1 + choice + K[index] + schedule[index];
            const auto sum0 = rotateRight(a, 2U) ^ rotateRight(a, 13U) ^ rotateRight(a, 22U);
            const auto majority = (a & b) ^ (a & c) ^ (b & c);
            const auto temp2 = sum0 + majority;

            h = g;
            g = f;
            f = e;
            e = d + temp1;
            d = c;
            c = b;
            b = a;
            a = temp1 + temp2;
        }

        state[0] += a;
        state[1] += b;
        state[2] += c;
        state[3] += d;
        state[4] += e;
        state[5] += f;
        state[6] += g;
        state[7] += h;
    }

    std::ostringstream out;
    out << std::hex << std::setfill('0');
    for (const auto word : state) {
        out << std::setw(8) << word;
    }
    return out.str();
}

} // namespace horn::detail
