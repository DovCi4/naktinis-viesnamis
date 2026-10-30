# Naktinis Viešnamis – pilna JavaScript versija

Šiame projekte yra:

- Node.js ir Express serveris
- Registracija ir prisijungimas
- Slaptažodžių šifravimas su bcrypt
- Sesijos
- Temų kūrimas
- Komentarai
- GIF logotipo įkėlimas
- 5 sekundžių loading ekranas
- Duomenų saugojimas JSON failuose
- Modernus dizainas

## Paleidimas

Atidaryk terminalą šiame aplanke ir įrašyk:

```bash
npm install
npm start
```

Tada naršyklėje atidaryk:

```text
http://localhost:3000
```

## Administratoriaus paskyra

```text
Vardas: admin
Slaptažodis: admin123
```

Prisijungus kaip administratorius viršuje atsiras mygtukas:

```text
Keisti GIF logotipą
```

Leidžiamas tik `.gif` failas iki 8 MB.

## Duomenys

Duomenys saugomi:

- `data/users.json`
- `data/topics.json`
- `data/settings.json`

Įkelti logotipai saugomi:

- `public/uploads`
