# Scenariusz prezentacji Policy Checker

## Główna teza prezentacji

> Policy Checker zamienia rozproszone polityki biznesowe w deterministyczny, wersjonowany i audytowalny proces decyzyjny. System nie tylko zwraca decyzję, ale pokazuje również jej powody, wymagane działania oraz dokładną wersję polityki, która została użyta.

Najlepsza prezentacja nie polega na mechanicznym przejściu po ekranach. Pokaż jeden wniosek przechodzący przez cały proces, a każdą zmianę roli uzasadnij odpowiedzialnością biznesową.

## Zalecany czas

- Wersja pełna: 12-15 minut.
- Pytania techniczne: 5-10 minut.
- Wersja awaryjna: 5 minut, opisana na końcu dokumentu.

## Przygotowanie przed spotkaniem

1. Otwórz wdrożoną aplikację i sprawdź, czy odpowiada.
2. Przygotuj nieszkodliwy plik `demo-dpa.pdf`. Jego treść nie jest analizowana; plik służy do pokazania uploadu MinIO i ponownej oceny.
3. Kliknij `Reset demo` tuż przed prezentacją. Rób to wyłącznie w środowisku demonstracyjnym.
4. Ustaw powiększenie przeglądarki na 90-100% i zamknij zbędne zakładki.
5. Miej otwarte w edytorze następujące pliki na wypadek pytań technicznych:
   - `src/domain/policy/ruleEngine.ts`
   - `src/server/policyService.ts`
   - `src/server/requestAccess.ts`
   - `prisma/schema.prisma`
6. Nie zaczynaj od kodu. Najpierw pokaż problem biznesowy i przepływ użytkownika, a kod wykorzystaj do wyjaśnienia podjętych decyzji.

## Mapa prezentacji

| Czas | Rola | Co pokazujesz | Najważniejsza myśl |
|---|---|---|---|
| 0:00-0:45 | - | Wprowadzenie | System standaryzuje i wyjaśnia decyzje. |
| 0:45-1:30 | Reviewer | `Overview` | Operacyjny obraz procesu i scenariuszy. |
| 1:30-3:15 | Maja Requester | Acme Analytics | Brak DPA ma wyższy priorytet niż wymagana ocena. |
| 3:15-4:30 | Nina Policy Owner | `Policy studio` | Polityki są wersjonowane i oddzielone od publikacji. |
| 4:30-5:45 | Marek Policy Approver | `Policy approvals` | Separacja obowiązków i kontrolowana publikacja v2. |
| 5:45-7:15 | Maja Requester | Upload DPA | Dokument usuwa brak i uruchamia nową ocenę. |
| 7:15-9:00 | Olek Reviewer | `Review queue` | Człowiek obsługuje tylko sprawy wymagające oceny. |
| 9:00-11:30 | Adam Auditor | `Audit trail` | Można odtworzyć obie oceny i użyte wersje polityk. |
| 11:30-13:30 | - | Architektura i kod | Determinizm, snapshoty, RBAC, MinIO. |
| 13:30-14:30 | - | Ograniczenia i zakończenie | Świadome granice MVP i kierunek rozwoju. |

## Mapa kryteriów akceptacji MVP

| Kryterium z dokumentacji | Gdzie pokazujesz je podczas prezentacji |
|---|---|
| 1. Utworzenie i złożenie wniosku | Formularz Mai oraz gotowy wniosek Acme. |
| 2. Deterministyczna ocena | Acme i wyjaśnienie `ruleEngine.ts`. |
| 3. Cztery możliwe decyzje | Acme: `MISSING_INFORMATION`, Looker: `REQUIRES_REVIEW`, laptopy: `APPROVED`, AdBlaster: `REJECTED`. |
| 4. Zrozumiałe uzasadnienie | `Why this decision`, `Next steps` i rule trace. |
| 5. Polityki, wersje i reguły | `Policy studio`, registry, Rule builder i Rule console. |
| 6. Użycie opublikowanej polityki | Publikacja v2 i ponowna ocena Acme. |
| 7. Snapshoty i wersje polityk | Dwie oceny Acme w Audit Trail. |
| 8. Obsługa przez Reviewera | Acme w `Review queue` i zwykłe `Approve`. |
| 9. Manual override z powodem | RedTeam Labs, `Approved with exception`. |
| 10. Odtworzenie historycznej decyzji | Adam Auditor, wybór konkretnej oceny. |
| 11. Metryki operacyjne | `Overview` na początku prezentacji. |
| 12. Role i uprawnienia | Zmiana aktorów oraz wyjaśnienie `requestAccess.ts`. |

---

## Pełny skrypt prezentacji

### 1. Otwarcie: problem biznesowy

**Nie klikaj jeszcze niczego. Powiedz:**

> W wielu organizacjach zasady zakupowe, bezpieczeństwa i zgodności są zapisane w PDF-ach, arkuszach albo pozostają wiedzą konkretnych osób. W rezultacie podobne wnioski mogą otrzymywać różne decyzje, a po kilku miesiącach trudno odtworzyć, dlaczego dana decyzja została podjęta.
>
> Policy Checker rozwiązuje ten problem przez deterministyczne reguły biznesowe. Dla każdego wniosku zwraca jedną decyzję, jej uzasadnienie, wymagane dalsze kroki i wersje polityk użyte w momencie oceny. AI nie podejmuje decyzji, dzięki czemu wynik jest powtarzalny i audytowalny.

**Dodaj jedno zdanie techniczne:**

> Jest to aplikacja fullstack Next.js z PostgreSQL i Prisma, a pliki są przechowywane w MinIO zgodnym z S3.

### 2. Overview: pokaż proces, zanim wejdziesz w szczegóły

**Kliknięcia:**

1. W `Demo actor` wybierz `Olek Reviewer`.
2. Otwórz `Overview`.
3. Wskaż liczniki oraz `Primary UX scenarios`.

**Powiedz:**

> Dashboard nie jest głównym silnikiem aplikacji, tylko operacyjnym punktem wejścia. Pokazuje liczbę wszystkich wniosków, sprawy z brakami, kolejkę ręcznej oceny oraz najczęściej uruchamiane reguły.
>
> Interfejs jest rozdzielony według ról. Requester składa wniosek, Reviewer podejmuje decyzję człowieka, Policy Owner zarządza treścią reguł, Policy Approver publikuje wersje, a Auditor odtwarza historię. Ten podział odpowiada separacji obowiązków w procesach compliance.

**Warto podkreślić:**

- Reviewer nie powinien przeglądać przypadkowych rekordów; pracuje na kolejce `IN_REVIEW`.
- Policy Owner nie publikuje sam swojej zmiany.
- Auditor jest rolą tylko do odczytu.

### 3. Requester: kanoniczny scenariusz Acme Analytics

**Kliknięcia:**

1. Wybierz `Maja Requester`.
2. W `My requests` wybierz `Acme Analytics dla zespołu marketingu`.
3. Wskaż status `Needs information` i decyzję `Missing information`.
4. Pokaż `Why this decision`, `Next steps`, `Missing information` i `Required approvers`.
5. Jeszcze nie dodawaj DPA.

**Powiedz:**

> To scenariusz bezpośrednio z dokumentacji: zakup SaaS za 8 000 EUR, dostawca z USA, przetwarzanie danych osobowych i brak DPA.
>
> Zadziałały dwie istotne reguły. Koszt powyżej 5 000 EUR wymaga oceny Procurement, a przetwarzanie danych osobowych bez DPA wymaga uzupełnienia dokumentu. Wynikiem końcowym jest `MISSING_INFORMATION`, ponieważ priorytet decyzji to `REJECTED`, następnie `MISSING_INFORMATION`, później `REQUIRES_REVIEW`, a na końcu `APPROVED`.

**Pokaż zrozumienie domeny:**

> System nie wysyła niekompletnego wniosku do Reviewera. Najpierw wymusza kompletność danych, a dopiero potem angażuje człowieka. To ogranicza pracę manualną i zapobiega ocenianiu spraw bez wymaganych dokumentów.

**Pokaż dynamiczny formularz:**

1. Kliknij `Add new`.
2. Włącz `Vendor processes personal data`.
3. Wskaż pojawienie się sekcji `Data protection`.
4. Nie zapisuj nowego wniosku; wróć, klikając ponownie rekord Acme.

**Powiedz:**

> Formularz stosuje progressive disclosure. Pytania o kategorie danych, DPA, transfer poza EOG i kwestionariusz bezpieczeństwa pojawiają się dopiero wtedy, gdy dostawca przetwarza dane osobowe.

### 4. Policy Owner: wersjonowanie zamiast edycji produkcji

**Kliknięcia:**

1. Wybierz `Nina Policy Owner`.
2. Otwórz `Policy studio`.
3. W `Policy registry` pokaż zakładki `Published` oraz `Drafts`.
4. Wskaż opublikowaną `Politykę akceptacji zakupów` v1.
5. W `Drafts` pokaż kandydaturę obniżającą próg SaaS z 5 000 EUR do 3 000 EUR.
6. Pokaż `Rule builder` i `Rule console`, ale nie twórz kolejnej wersji tej samej polityki.

**Powiedz:**

> Opublikowanej polityki nie edytuję bezpośrednio. Tworzę nową wersję roboczą, opcjonalnie kopiuję dotychczasowe reguły, testuję zmianę i przekazuję ją do zatwierdzenia.
>
> Draft nie dostaje jeszcze numeru publikacyjnego. Numer v2 zostanie nadany dopiero przy publikacji. Dzięki temu porzucone lub odrzucone drafty nie tworzą luk w numeracji.

**O Rule builderze powiedz:**

> Kreator zapisuje ustrukturyzowane warunki i efekty, a nie wykonywalny kod. Warunki mogą korzystać z operatorów takich jak `equals`, `greater_than`, `in` czy `is_empty` oraz grup `ALL` i `ANY`. Efektem może być akceptacja, odrzucenie, wymóg pola, skierowanie do Reviewera, kod powodu albo punkty ryzyka.

**O Rule console powiedz:**

> Konsola pozwala przetestować aktywne polityki, całą zapisaną wersję roboczą albo jeszcze niezapisaną regułę z edytora. Test nie publikuje zmiany i nie wpływa na realne wnioski.

### 5. Policy Approver: publikacja nowej wersji

**Kliknięcia:**

1. Wybierz `Marek Policy Approver`.
2. Otwórz `Policy approvals`.
3. Wybierz kandydaturę `Polityki akceptacji zakupów`.
4. Wskaż `Current publication`, `Candidate publication` i `Rules in this version`.
5. Omów warunek: `SAAS`, `EUR`, koszt większy niż 3 000.
6. Kliknij `Approve & publish`.
7. W `Published change history` pokaż nową v2 i zarchiwizowaną v1.

**Powiedz przed kliknięciem publikacji:**

> Policy Approver widzi dokładnie, co publikuje: podsumowanie zmiany, numer kandydacki oraz wszystkie reguły. Może zatwierdzić albo odrzucić wersję z powodem.

**Powiedz po publikacji:**

> Publikacja jest kontrolowaną zmianą stanu. Kandydat otrzymuje numer v2, poprzednia v1 zostaje zarchiwizowana, a nowe oceny użyją v2. Historyczne oceny nadal wskazują v1.

### 6. Requester: dodanie DPA i automatyczna ponowna ocena

**Kliknięcia:**

1. Wybierz `Maja Requester`.
2. Otwórz ponownie `Acme Analytics dla zespołu marketingu`.
3. Kliknij `Add DPA & re-evaluate`.
4. Wybierz przygotowany `demo-dpa.pdf`.
5. Poczekaj na komunikat sukcesu i odświeżone szczegóły.
6. Wskaż zmianę z `Needs information` na `In review` oraz decyzję `Requires review`.

**Powiedz:**

> Upload DPA nie jest tylko dołączeniem pliku do historii. Backend zapisuje metadane załącznika, ustawia fakt `hasDpa`, aktualizuje dane wejściowe i od razu uruchamia nową ocenę.
>
> Brak dokumentu został usunięty, ale nadal działa reguła kosztowa, dlatego wynik zmienia się na `REQUIRES_REVIEW`. Ponieważ przed chwilą opublikowaliśmy v2, ta nowa ocena korzysta już z nowego progu polityki.

**Ważne technicznie:**

> Sam plik trafia do MinIO przez czasowy presigned URL. Aplikacja przechowuje w PostgreSQL jego typ biznesowy, MIME type, rozmiar i klucz obiektu. Dostęp do uploadu i pobierania jest kontrolowany po stronie API.

### 7. Reviewer: decyzja człowieka

**Kliknięcia:**

1. Wybierz `Olek Reviewer`.
2. Otwórz `Review queue`.
3. Wybierz Acme, które po dodaniu DPA powinno znajdować się w kolejce.
4. W zakładce `Decision & rules` pokaż powody, wymaganych approverów i `Rule trace`.
5. W `Collaboration` wskaż komentarze publiczne i wewnętrzne oraz załącznik DPA.
6. W `Make decision` wybierz zwykłe `Approve`.
7. Wskaż wymagane `Reason` i `Comment`, następnie zatwierdź.

**Powiedz:**

> Reviewer widzi wyłącznie sprawy z decyzją systemową `REQUIRES_REVIEW` i statusem `IN_REVIEW`. Nie musi interpretować surowego JSON-a: widzi regułę, politykę, oczekiwaną wartość, faktyczną wartość oraz biznesowy powód.
>
> Decyzja człowieka wymaga powodu i komentarza. Zwykła akceptacja zamyka review jako `APPROVED`. `Approve as exception` jest innym przypadkiem: zachowuje oryginalną decyzję systemową i zapisuje osobny, audytowany manual override wraz z approverem wyjątku.

**Nie wykonuj wyjątku na Acme.** Gotowy przykład wyjątku pokażesz na rekordzie RedTeam Labs w audycie.

### 8. Auditor: odtworzenie decyzji i integralność historii

**Kliknięcia:**

1. Wybierz `Adam Auditor`.
2. Otwórz `Audit trail`.
3. Wyszukaj lub wybierz Acme.
4. W `Evaluation history` wybierz najstarszą ocenę.
5. Wskaż `Missing information`, snapshot wejścia, dopasowane reguły i politykę v1.
6. Wybierz nowszą ocenę po dodaniu DPA.
7. Wskaż zmianę faktu `Has DPA`, wynik `Requires review` i politykę v2.
8. Pokaż sekcję `Human decisions and exceptions` z decyzją Reviewera.
9. Kliknij `Export evaluation CSV`, aby pokazać możliwość eksportu.

**Powiedz:**

> To najważniejszy dowód integralności systemu. Pierwsza ocena nie zmieniła się po publikacji nowej polityki ani po dodaniu DPA. Ma własny input snapshot, result snapshot i listę zastosowanych wersji polityk. Druga ocena jest nowym rekordem i pokazuje nowy stan danych oraz v2.
>
> Dzięki temu pytanie audytora nie brzmi „jaka polityka obowiązuje dzisiaj?”, tylko „jaka polityka i jakie dane zostały użyte dokładnie w momencie tej decyzji?”.

**Pokaż manual override:**

1. W Audit Trail wybierz `Usługa testów penetracyjnych` od RedTeam Labs.
2. Wskaż oryginalną decyzję systemową `Requires review`.
3. Wskaż efektywny wynik `Approved` / status `Approved with exception`.
4. Pokaż powód wyjątku, autora oraz `Exception approver`.

**Powiedz:**

> Manual override nie nadpisuje oryginalnej decyzji. System przechowuje obok siebie wynik silnika i późniejszą decyzję człowieka. To realizuje zasadę, że historia decyzji musi pozostać możliwa do odtworzenia.

### 9. Wyjaśnienie architektury i kodu

Po zakończeniu historii biznesowej możesz przejść na 1-2 minuty do kodu.

#### `ruleEngine.ts`: deterministyczna decyzja

**Pokaż:** `decisionRank`, `matchFieldCondition`, `evaluateCondition`, `evaluatePolicyVersions`.

**Powiedz:**

> Silnik jest funkcją domenową bez zależności od UI i bazy. Dostaje input oraz konkretne definicje wersji polityk. Każdy warunek produkuje nie tylko boolean, ale również fakty: pole, operator, wartość oczekiwaną, wartość faktyczną i informację o dopasowaniu.
>
> Następnie efekty dopasowanych reguł są agregowane. `chooseDecision` korzysta z jawnego rankingu, więc wynik nie zależy od kolejności przypadkowych instrukcji ani od modelu AI. Ta sama polityka i ten sam input dadzą ten sam wynik.

#### `policyService.ts`: zapis oceny

**Pokaż:** `loadPublishedPolicyVersions`, `buildRequestInput`, `evaluateRequestAndPersist`.

**Powiedz:**

> Warstwa serwisowa pobiera wyłącznie opublikowane i aktualnie obowiązujące wersje. Buduje kanoniczny input, uruchamia silnik, a następnie zapisuje ocenę, snapshot wejścia, snapshot wyniku, wersje polityk, wyniki reguł i zdarzenie audytowe.

#### `schema.prisma`: model hybrydowy historii

**Pokaż:** `PolicyEvaluation`, `PolicyEvaluationRuleMatch`, `ManualOverride`, `AuditEvent`.

**Powiedz:**

> Wybrałem model hybrydowy. Pełne snapshoty są zapisane jako JSON, bo muszą zachować dokładny historyczny kształt. Najważniejsze elementy są również relacyjne: ocena, dopasowania reguł i manual override. Dzięki temu historia jest wierna, ale nadal można ją wyszukiwać i prezentować biznesowo.

#### `requestAccess.ts`: RBAC

**Powiedz:**

> Kontrola dostępu nie kończy się na ukrywaniu przycisków. API sprawdza rolę i własność wniosku. Requester widzi własne sprawy i komentarze publiczne, Reviewer ma dostęp do procesu oceny, a Auditor ma pełny odczyt bez możliwości modyfikacji.

### 10. Świadome granice MVP

Powiedz o nich sam, zanim ktoś zarzuci ich pominięcie:

> Świadomie ograniczyłem zakres do MVP. Przełącznik `Demo actor` symuluje tożsamość; w produkcji zastąpiłbym go sesją i SSO, zachowując istniejące reguły autoryzacji po stronie API. Kreator wspiera condition builder, ale nie decision table. MinIO działa, natomiast maksymalny rozmiar i whitelistę MIME trzeba ustalić biznesowo i egzekwować przed produkcją. Panel administracyjny i zarządzanie słownikami również pozostają poza MVP.

Opcjonalnie dodaj:

> Kolejnym krokiem skalowania byłoby stronicowanie historii ocen osobnym endpointem, preagregacja dashboardu oraz mocniejsze ograniczenia uploadu.

### 11. Zakończenie

**Powiedz:**

> Najważniejszym rezultatem nie jest sam formularz zakupowy. Jest nim spójny łańcuch odpowiedzialności: wersjonowana polityka, deterministyczna ocena, decyzja człowieka i możliwy do odtworzenia audyt. System skraca czas prostych decyzji, kieruje do ludzi tylko wyjątki i pozostawia dowód, dlaczego każda decyzja została podjęta.

---

## Jak wykazać się zrozumieniem, a nie tylko znajomością interfejsu

Używaj następujących rozróżnień:

### Decision a status

- `decision` opisuje wynik konkretnej oceny silnika: `APPROVED`, `REQUIRES_REVIEW`, `REJECTED`, `MISSING_INFORMATION`.
- `status` opisuje etap procesu, np. `NEEDS_INFORMATION`, `IN_REVIEW`, `APPROVED_WITH_EXCEPTION`.
- Przykład: systemowa decyzja może pozostać `REQUIRES_REVIEW`, a efektywny wynik po manual override może być `APPROVED`.

### Polityka a wersja polityki

- Policy jest logicznym zbiorem zasad, np. polityką zakupową.
- PolicyVersion jest niemutowalną publikacją tych zasad w czasie.
- Draft nie wpływa na oceny produkcyjne.
- Dopiero publikacja nadaje numer i zmienia wersję aktywną.

### Reguła a efekt reguły

- Warunek odpowiada na pytanie, czy reguła pasuje do inputu.
- Efekt mówi, co zrobić po dopasowaniu.
- Jedna reguła może dostarczyć kilka efektów, np. wymagać Reviewera i dodać kod powodu.

### Wynik systemu a decyzja człowieka

- Wynik systemu pochodzi z deterministycznych polityk.
- Decyzja Reviewera jest oddzielnym zdarzeniem procesu.
- Manual override nie może niszczyć oryginalnego wyniku systemowego.

### Bieżący rekord a snapshot

- Request zawiera bieżący stan wniosku.
- PolicyEvaluation zawiera stan użyty podczas konkretnej oceny.
- Zmiana Request albo publikacja nowej polityki nie może zmienić starego snapshotu.

---

## Pytania, które prawdopodobnie padną

### Dlaczego nie użyłeś AI do decyzji?

> Wymaganiem jest determinizm i audytowalność. Model probabilistyczny utrudniałby wykazanie, że ten sam input i ta sama wersja polityki zawsze dadzą ten sam wynik. AI może kiedyś pomagać w pisaniu reguł, ale nie powinno podejmować finalnej decyzji.

### Co się stanie po zmianie polityki?

> Tylko nowe oceny użyją nowej opublikowanej wersji. Stare oceny zachowują snapshot inputu, wyniku i identyfikator użytej wersji. Draft i wersja `IN_REVIEW` nie biorą udziału w ocenie.

### Dlaczego przechowujesz jednocześnie JSON i dane relacyjne?

> Snapshot JSON wiernie zachowuje cały historyczny kontrakt, nawet jeśli model wejścia później się rozwinie. Dane relacyjne ułatwiają filtrowanie, relacje i czytelny UI. To kompromis między integralnością historii i użytecznością operacyjną.

### Jak działa priorytet wielu reguł?

> Wszystkie aktywne reguły są oceniane, a ich efekty są agregowane. Najsilniejsza decyzja wygrywa według jawnego rankingu: `REJECTED > MISSING_INFORMATION > REQUIRES_REVIEW > APPROVED`. Powody i dalsze kroki ze wszystkich dopasowanych reguł pozostają widoczne.

### Czy Reviewer może zmienić automatyczną decyzję?

> Może podjąć decyzję w procesie ręcznej oceny albo zatwierdzić wyjątek zgodnie z uprawnieniami. Oryginalna decyzja systemu nie jest nadpisywana. Powstaje osobny rekord z autorem, powodem, komentarzem i approverem wyjątku.

### Jak zabezpieczone są załączniki?

> Pliki trafiają do MinIO przez krótkotrwałe presigned URL. API sprawdza rolę i własność wniosku przed wygenerowaniem uploadu lub downloadu. W bazie zapisuję metadane i storage key, a nie treść pliku.

### Czy RBAC jest produkcyjny?

> Reguły autoryzacji są wykonywane po stronie API, ale tożsamość aktora jest w MVP wybierana przełącznikiem demonstracyjnym. Produkcyjnie actorId musi pochodzić z zaufanej sesji lub tokenu SSO, nie z danych przesyłanych przez klienta.

### Dlaczego Policy Owner nie może od razu publikować?

> To separacja obowiązków. Autor przygotowuje i testuje zmianę, a inna rola sprawdza jej wpływ i publikuje. Zmniejsza to ryzyko niekontrolowanej zmiany reguł decyzyjnych.

### Co zrobiłbyś dalej?

> Najpierw dodałbym prawdziwe uwierzytelnienie i SSO, limity oraz skanowanie plików, osobno stronicowaną historię ocen, preagregację metryk i panel administratora dla słowników. Dopiero później rozważałbym AI jako asystenta tworzenia reguł, nigdy jako źródło decyzji.

---

## Wersja skrócona: 5 minut

1. **30 s - problem:** polityki są rozproszone, decyzje niespójne, brak audytu.
2. **60 s - Maja / Acme:** pokaż `MISSING_INFORMATION`, dwa powody, brak DPA i priorytet decyzji.
3. **45 s - Marek:** pokaż kandydaturę v2 i `Rules in this version`; nie musisz jej publikować w wersji skróconej.
4. **45 s - Olek:** pokaż Looker w `Review queue`, rule trace oraz formularz decyzji.
5. **90 s - Adam:** pokaż RedTeam Labs, oryginalne `REQUIRES_REVIEW`, zatwierdzony wyjątek, snapshoty i wersje polityk.
6. **45 s - technika:** deterministyczny rule engine, PostgreSQL/Prisma, snapshoty, RBAC i MinIO.
7. **15 s - zakończenie:** wersjonowana polityka, wyjaśnialna decyzja i pełny ślad odpowiedzialności.

## Zdania ratunkowe podczas prezentacji

- Gdy upload trwa: „Plik jest przesyłany bezpośrednio do MinIO przez presigned URL; po zapisie metadanych backend uruchomi nową ocenę”.
- Gdy nie chcesz mutować danych: „Ten sam rezultat jest już widoczny na przygotowanym rekordzie demonstracyjnym, więc pokażę go bez zmiany stanu środowiska”.
- Gdy ktoś pyta o ekran: „Najpierw wyjaśnię odpowiedzialność tej roli, a potem pokażę odpowiadającą jej akcję”.
- Gdy ktoś pyta o brakującą funkcję: „To świadoma granica MVP. W modelu zostawiłem miejsce na rozwój, ale nie rozszerzałem zakresu bez wymagania biznesowego”.
- Gdy pojawi się błąd sieci: przejdź do wersji skróconej i wykorzystaj istniejące rekordy Looker, RedTeam Labs oraz Audit Trail.

## Ostatnia checklista

- [ ] `Reset demo` wykonany.
- [ ] Plik `demo-dpa.pdf` jest pod ręką.
- [ ] Acme ma `Needs information` przed rozpoczęciem historii.
- [ ] Kandydatura polityki zakupowej jest widoczna w approval queue.
- [ ] Looker znajduje się w Review queue jako plan awaryjny.
- [ ] RedTeam Labs ma gotowy przykład manual override.
- [ ] Kod źródłowy jest otwarty w czterech najważniejszych plikach.
- [ ] Potrafisz powiedzieć priorytet decyzji bez patrzenia: `REJECTED > MISSING_INFORMATION > REQUIRES_REVIEW > APPROVED`.
