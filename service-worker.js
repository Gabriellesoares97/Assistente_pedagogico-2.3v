// Service Worker do Assistente de Turmas
// Guarda os arquivos do próprio app em cache pra funcionar offline depois de instalado.
// IMPORTANTE: isso só é registrado (veja o HTML) quando o app está sendo servido
// por http(s) ou localhost — navegadores não permitem Service Worker em arquivos
// abertos direto do computador (file://).

const CACHE_NAME = "diario-turmas-cache-v2"; // subir esse número força os aparelhos já
// instalados a buscar a versão nova, em vez de ficarem presos numa versão antiga em cache

// arquivos do "app shell" que precisam estar disponíveis mesmo sem internet
const ARQUIVOS_PARA_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
      .catch(() => {}) // se algum arquivo não existir nesse servidor, não trava a instalação
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => nome !== CACHE_NAME) // limpa versões antigas de cache de instalações anteriores
            .map((nome) => caches.delete(nome))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // só cuida de pedidos GET do próprio app; deixa passar direto qualquer
  // chamada à planilha do Google (sincronização), que sempre precisa ir pra rede
  if (req.method !== "GET") return;
  if (req.url.includes("script.google.com")) return;

  // o arquivo principal do app (a "casca": index.html e manifest.json) usa
  // "rede primeiro" — assim, sempre que houver internet, a pessoa recebe a
  // versão mais nova publicada, em vez de ficar presa numa versão antiga em
  // cache pra sempre. Só cai pro cache quando estiver mesmo sem internet.
  const ehArquivoPrincipal =
    req.mode === "navigate" || req.url.endsWith("/index.html") || req.url.endsWith("/manifest.json");

  if (ehArquivoPrincipal) {
    event.respondWith(
      fetch(req)
        .then((respostaRede) => {
          const copia = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(req, copia); } catch (e) {}
          });
          return respostaRede;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // demais arquivos (ícones, etc.) quase nunca mudam — cache primeiro continua
  // fazendo sentido pra esses, é mais rápido e economiza dados
  event.respondWith(
    caches.match(req).then((respostaCache) => {
      if (respostaCache) return respostaCache;

      return fetch(req)
        .then((respostaRede) => {
          // guarda uma cópia no cache pra da próxima vez, se estiver sem internet
          const copia = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(req, copia); } catch (e) {}
          });
          return respostaRede;
        })
        .catch(() => {
          // completamente offline e não tinha essa página em cache:
          // mostra o app principal mesmo assim, em vez de dar erro
          return caches.match("./index.html");
        });
    })
  );
});
