# Putzplan App

Die App ist als kleine installierbare Web-App fuer Android gebaut.

## Start lokal

Am einfachsten die Datei [index.html](/C:/Users/Dell/Documents/Putzplan/pwa/index.html) im Browser oeffnen.

Noch besser mit einem kleinen lokalen Server, damit Service Worker und Installation sauber laufen:

```powershell
cd C:\Users\Dell\Documents\Putzplan\pwa
python -m http.server 8080
```

Danach im Android-Browser oder am PC auf `http://<deine-ip>:8080` gehen.

## Auf Android installieren

1. Seite in Chrome oeffnen.
2. Browser-Menue oeffnen.
3. `Zum Startbildschirm hinzufuegen` oder `App installieren` waehlen.

## Inhalt

- Tagesansicht fuer 12 Wochen
- Filter fuer `Alle`, `Laura`, `Dino`
- faire Aufgabenverteilung aus dem aktuellen Plan
- neue eigene Aufgaben mit Wiederholung

## Gemeinsamer Plan mit Supabase

Damit Laura und du immer denselben Plan seht:

1. In Supabase ein Projekt anlegen.
2. Das SQL aus [supabase-setup.sql](/C:/Users/Dell/Documents/Putzplan/pwa/supabase-setup.sql) im SQL Editor ausfuehren.
3. In [supabase-config.js](/C:/Users/Dell/Documents/Putzplan/pwa/supabase-config.js) diese Werte eintragen:

```js
window.SUPABASE_CONFIG = {
  url: "DEINE_SUPABASE_URL",
  anonKey: "DEIN_SUPABASE_ANON_KEY",
  householdId: "laura-dino",
};
```

4. Danach die App auf beiden Geraeten neu laden.

Dann werden neue Tasks online gespeichert und zwischen beiden Geraeten synchronisiert.

## Online auf Netlify veroeffentlichen

So ist die App auch ausserhalb deiner Wohnung erreichbar:

1. Auf [Netlify](https://www.netlify.com/) ein kostenloses Konto anlegen.
2. `Add new site` waehlen.
3. Den Ordner [pwa](/C:/Users/Dell/Documents/Putzplan/pwa) als statische Seite deployen.
4. Netlify gibt dir danach eine feste Internet-Adresse.

Wichtig:

- Die App ist komplett statisch, deshalb reicht der kostenlose Netlify-Plan sehr wahrscheinlich aus.
- [netlify.toml](/C:/Users/Dell/Documents/Putzplan/pwa/netlify.toml) ist schon vorbereitet.
- Nach einem Deploy sehen Laura und du dieselbe aktuelle Version.

## Spaetere Updates

Wenn du spaeter etwas an der App aendern willst:

1. Ich passe die Dateien hier an.
2. Du veroeffentlichst die aktualisierte `pwa`-Version erneut auf Netlify.
3. Danach ist die neue Version fuer alle live.
