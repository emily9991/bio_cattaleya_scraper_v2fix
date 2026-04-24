    function extraerItemListadoMainWorld(callback) {
      var eventName = "__bsc_fiber_" + Date.now();
      window.addEventListener(eventName, function handler(e) {
        window.removeEventListener(eventName, handler);
        callback(e.detail || []);
      }, { once: true });
      var script = document.createElement("script");
      script.textContent = "(function() {" +
        "var result = [];" +
        "var cards = document.querySelectorAll('[class*=\"cardContainer--\"]');" +
        "var firstCard = cards[0];" +
        "if (firstCard) {" +
          "var parentEl = firstCard.parentElement;" +
          "var fk = Object.keys(parentEl).find(function(k){ return k.indexOf('__reactFiber') === 0 || k.indexOf('__reactInternalInstance') === 0; });" +
          "var items = fk && parentEl[fk].memoizedProps && parentEl[fk].memoizedProps.children && parentEl[fk].memoizedProps.children[0];" +
          "if (items && items.length) {" +
            "items.forEach(function(r) {" +
              "var d = r && r.props && r.props.itemCardData;" +
              "if (d && d.itemId) result.push({ itemId: String(d.itemId), title: d.title||'', itemUrl: d.itemUrl||'', image: d.image||'', index: result.length });" +
            "});" +
          "}" +
        "}" +
        "window.dispatchEvent(new CustomEvent(\"" + eventName + "\", { detail: result }));" +
      "})()";
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    }

    function extraerItemListado() {
      var firstCard = document.querySelector('[class*="cardContainer--"]');
      if (firstCard) {
        extraerItemListadoMainWorld(function(items) {
          if (items && items.length > 0) {
            bscLog("extraerItemListado", "tmall_fiber", {cards: items.length});
            var cardNodes = document.querySelectorAll('[class*="cardContainer--"]');
            items.forEach(function(data) {
              if (listingItems.length >= 30) return;
              var idKey = String(data.itemId);
              if (listingUrls.has(idKey)) return;
              listingUrls.add(idKey);
              var url = data.itemUrl || ("https://detail.tmall.com/item.htm?id=" + data.itemId);
              var cardEl = cardNodes[data.index] || firstCard;
              listingItems.push({
                title: data.title || "",
                url: url,
                image: data.image || "",
                price: extraerPrecioCard(cardEl),
                source: "tmall_fiber"
              });
            });
            bscLog("extraerItemListado", "tmall_result", {total: listingItems.length});
            if (listingItems.length > 0) {
              chrome.runtime.sendMessage({ action: "update_badge", count: listingItems.length });
            }
            if (listingItems.length >= 30) {
              detenerListingObserver();
              console.log("[BSC] listing: limite de 30 items alcanzado, observer detenido");
            }
            return;
          }
          extraerItemListadoClassic();
        });
        return;
      }
      extraerItemListadoClassic();
    }

    function extraerItemListadoClassic() {
      var selectors = [
        '[class*="item--"]',
        '[class*="Card--"]',
        '[class*="product--"]',
        ".item", ".product"
      ];
      selectors.forEach(function(sel) {
        if (listingItems.length >= 30) return;
        document.querySelectorAll(sel).forEach(function(el) {
          if (listingItems.length >= 30) return;
          var link = el.querySelector("a[href]") || el.closest("a[href]");
          if (!link) return;
          var url = link.href;
          var baseUrl = url.split("?")[0];
          if (listingUrls.has(baseUrl)) return;
          listingUrls.add(baseUrl);
          var titleEl = el.querySelector('[class*="title--"], [class*="name--"], h3, h4');
          var priceEl = el.querySelector('[class*="price--"]');
          var imgEl = el.querySelector("img");
          listingItems.push({
            title: titleEl ? titleEl.innerText.trim() : "",
            url: url,
            image: imgEl ? (imgEl.src || imgEl.getAttribute("placeholder") || "") : "",
            price: priceEl ? priceEl.innerText.trim() : "",
            source: "classic"
          });
        });
      });
      bscLog("extraerItemListado", "classic_result", {total: listingItems.length});
    }

    function procesarMutaciones() {
      if (listingItems.length >= 30) return;
      if (document.querySelectorAll('[class*="cardContainer--"]').length === 0) return;
      bscLog("listing", "procesarMutaciones llamado", { total: listingItems.length, url: location.href });
      extraerItemListado();
    }
