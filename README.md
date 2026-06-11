# Policy Checker — MVP

Aplikacja webowa, która sprawdza, czy **wnioski zakupowe i wdrożenia dostawców** spełniają obowiązujące w organizacji polityki. Dla każdego wniosku zwraca jedną decyzję wraz z pełnym uzasadnieniem („według polityki X w wersji Y wynik to Z”), historią ocen i śladem audytowym.

Projekt powstał jako case study rekrutacyjny dla **SKILL AND CHILL** na podstawie dokumentu wymagań *Policy Checker*. Poniżej opis tego, **co i jak zostało zbudowane** oraz **jakie świadome uproszczenia** przyjęto względem pełnej specyfikacji.

---

## 1. Kontekst (skrót dokumentacji)

W wielu organizacjach polityki zakupowe / bezpieczeństwa / zgodności żyją w PDF-ach, arkuszach i głowach ludzi — przez co decyzje są niespójne i trudne do audytu. Policy Checker przenosi te powtarzalne reguły do **deterministycznego, wersjonowanego silnika reguł**.

System odpowiada m.in. na pytania: czy wniosek spełnia aktywne polityki, które reguły zadziałały, czego brakuje, czy można zaakceptować automatycznie, kto musi zatwierdzić i jaka wersja polityki została użyta. Zgodnie z wymaganiami **AI nie jest źródłem decyzji** — wykonanie reguł jest w 100% deterministyczne.

Model decyzji (priorytet): `REJECTED > MISSING_INFORMATION > REQUIRES_REVIEW > APPROVED`.

---

## 2. Architektura rozwiązania

Aplikacja **fullstack Next.js** (jedno repo: UI + API), Prisma + PostgreSQL, pliki w storage S3-compatible (MinIO).

```
src/
├─ pages/
│  ├─ index.tsx            # cały UI: jeden ekran z przełącznikiem ról ("Demo actor")
│  └─ api/                 # REST API (Next API routes)
│     ├─ requests/…        # CRUD wniosków, ocena, komentarze, załączniki, override
│     ├─ policies/…        # polityki, wersje, submit-for-approval, publish, reject
│     ├─ rules, test-rules # kreator i konsola testowa reguł
│     ├─ upload/…          # presigned URL upload/download (MinIO)
│     └─ dashboard, bootstrap, demo/seed
├─ domain/policy/
│  ├─ ruleEngine.ts        # deterministyczny silnik reguł (serce systemu)
│  ├─ types.ts             # typy domenowe + schematy warunków/efektów (Zod)
│  └─ demoData.ts          # dane demonstracyjne (role, użytkownicy, polityki, wnioski)
├─ server/
│  ├─ policyService.ts     # ocena + zapis (snapshoty, audyt), seed bazy
│  ├─ memoryStore.ts       # tryb in-memory (demo bez bazy danych)
│  ├─ requestAccess.ts     # reguły RBAC (kto co może)
│  ├─ schemas.ts           # walidacja wejścia (Zod)
│  └─ minioClient.ts       # klient S3/MinIO + presigned URL
└─ lib/prisma.ts
```

**Stack:** Next.js 13 (pages router) · React 18 · TypeScript · Prisma 4 / PostgreSQL · Medusa UI + Tailwind · Zod (walidacja) · SWR (data fetching) · AWS SDK v3 (S3 / MinIO) · Vitest (testy).

### Jak działa ocena wniosku (FR-4)

1. Wniosek jest walidowany (Zod) i zapisywany.
2. `ruleEngine` pobiera **aktywne, opublikowane** wersje polityk i wykonuje ich reguły na danych wniosku.
3. Silnik obsługuje 12 operatorów (`equals`, `greater_than`, `in`, `is_empty`, …), łączenie warunków `ALL` / `ANY` oraz efekty `APPROVE / REQUIRE_REVIEW / REJECT / REQUIRE_FIELD / ADD_RISK_POINTS / ADD_REASON_CODE`.
4. Wyniki są agregowane do jednej decyzji wg priorytetu, wraz z: powodami, dopasowanymi regułami, brakującymi polami, wymaganymi akceptującymi i użytymi wersjami polityk.
5. Zapisywany jest **snapshot wejścia i wyniku** (niemutowalny) oraz zdarzenie audytowe.

### Role → ekrany (RBAC)

| Rola | Ekran / możliwości |
|---|---|
| **Requester** | Dynamiczny formularz wniosku, edycja i ponowne złożenie braków (UC-4), wynik z uzasadnieniem, komentarze publiczne |
| **Reviewer** | Kolejka spraw `IN_REVIEW`, decyzja (Approve / Reject / Request info / Approve as exception), komentarze publiczne i wewnętrzne, załączniki |
| **Policy Owner** | Polityki i wersje, kreator reguł (condition builder), konsola testowa |
| **Policy Approver** | Przegląd, zatwierdzenie / odrzucenie i publikacja wersji (`DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`) |
| **Auditor** | Historia ocen, snapshoty wejścia / wyniku, ręczne nadpisania i eksport CSV — tylko odczyt |
| **Dashboard** | Metryki operacyjne (wg statusu / decyzji, top reguły, brakujące pola, średni czas do decyzji) |

### Bezpieczeństwo i integralność (NFR-4, NFR-7)

- RBAC egzekwowane po stronie API (`requestAccess.ts`) na podstawie ról aktora.
- Komentarze wewnętrzne ukrywane przed wnioskodawcą; załączniki dostępne tylko dla uprawnionych.
- Walidacja całego wejścia przez Zod; kreator reguł operuje na strukturze warunków (brak `eval`, brak wykonywania kodu użytkownika).
- **Manual override nie nadpisuje** oryginalnej decyzji systemu — tworzy osobny, audytowany wpis; snapshoty ocen są niemutowalne.

---

## 3. Świadome uproszczenia względem dokumentacji

To jest MVP — poniżej najważniejsze decyzje „co pominęliśmy / uprościliśmy” i dlaczego.

| Obszar | W MVP | Pełna specyfikacja |
|---|---|---|
| **Uwierzytelnianie** | Brak logowania — przełącznik „Demo actor” wybiera użytkownika / rolę; RBAC działa na podstawie `actorId`. | SSO / SCIM, sesje, hasła (jawnie *poza MVP*). |
| **Manual override** | Jeden zatwierdzający wyjątek; UC-3 (decyzja recenzenta) i UC-9 (wyjątek) zapisane w jednym rekordzie `ManualOverride` z flagą `isException`. | Otwarta decyzja z §14 — możliwy wariant wielu zatwierdzających. |
| **Kreator reguł** | Tylko *condition builder* (warunki + efekty), bez surowego JSON jako głównego UI. | Opcjonalnie tabela decyzyjna (decision table) — §14. |
| **Załączniki** | Upload / lista / pobieranie w MinIO (S3, presigned URL), bez analizy treści; dodawane po utworzeniu wniosku (URL wymaga `id`). | Bez zmian — analiza treści i tak poza MVP. |
| **Lista wniosków (FR-6)** | Filtry: status, decyzja, kategoria, dział, pilność, wnioskodawca, wyszukiwanie + sortowanie po dacie + paginacja. | Dodatkowo „przeterminowane”, filtr po recenzencie, kolumna „wymagani akceptujący”. |
| **Pulpit (FR-18)** | Metryki liczone w locie. | Cache / preagregacja przy większym wolumenie. |
| **Słowniki / Admin (5.5, FR-20)** | Słowniki zaszyte w kodzie; rola ADMIN istnieje, ale bez panelu zarządzania. | Pełne zarządzanie użytkownikami, rolami i słownikami. |
| **Audytor (5.6)** | Pełny podgląd historii, snapshotów i eksport danych audytowych do CSV. | — |
| **Polityki demo** | 4 polityki (zakupy, ryzyko dostawcy, dane osobowe, finanse). | Np. „duplikacja narzędzi SaaS” ze scenariusza §15 — nieobjęta. |
| **AI** | Brak — silnik deterministyczny (zgodnie z NFR-3). | AI może w przyszłości *pomagać pisać* reguły, nigdy decydować. |

Dodatkowo dla wygody dema: tryb **in-memory** (`POLICY_CHECKER_MEMORY_DEMO=1`) uruchamia aplikację bez PostgreSQL, a przycisk **„Reset demo”** zasiewa komplet danych (7 wniosków pokrywających wszystkie statusy + historię: komentarze, załączniki, override’y).

### Zgodność z kryteriami MVP (§13)

Zrealizowane wszystkie 12 punktów akceptacji: utworzenie i złożenie wniosku, deterministyczna ocena, 4 decyzje z czytelnym uzasadnieniem, tworzenie polityk / wersji / reguł, użycie opublikowanej polityki, zapis wersji + snapshotów, obsługa wniosku przez recenzenta, manual override z wymaganym powodem, odtworzenie decyzji przez audytora, pulpit metryk, egzekwowanie ról. Kanoniczny scenariusz z §15 (SaaS 8 000 € / Acme / brak DPA) zwraca `MISSING_INFORMATION` z poprawnymi powodami i akceptującymi (Procurement, DPO).

---

## 4. Uruchomienie

```bash
npm install

# Wariant A — szybkie demo bez bazy danych
#   ustaw POLICY_CHECKER_MEMORY_DEMO=1 w .env.local
npm run dev

# Wariant B — z PostgreSQL
#   ustaw DATABASE_URL oraz MINIO_* w .env
npm run migrate:deploy   # migracje
npm run seed             # dane demonstracyjne (= przycisk "Reset demo")
npm run dev
```

Najważniejsze zmienne środowiskowe: `DATABASE_URL`, `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_PUBLIC_ENDPOINT` / `MINIO_PRIVATE_ENDPOINT` / `MINIO_BUCKET`, opcjonalnie `POLICY_CHECKER_MEMORY_DEMO=1`.

> Uwaga (Windows): jeśli ścieżka projektu zawiera `&`, część powłok psuje wywołania binarek z `node_modules`. Działa wtedy bezpośrednie wywołanie node, np.:
> ```powershell
> node .\node_modules\next\dist\bin\next dev --port 3100
> node .\node_modules\prisma\build\index.js migrate deploy
> ```

## 5. Testy

```bash
npm test
```

Vitest pokrywa rdzeń logiki niezależnie od UI: silnik reguł, schematy walidacji oraz cykl życia polityk i decyzji recenzenta (tryb in-memory).
