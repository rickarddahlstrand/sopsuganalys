/**
 * Explanatory texts for info buttons throughout the webapp.
 *
 * Sources:
 *   - rapport_pdf.py (strategy, quarterly focus, dynamic analysis)
 *   - SVOA "Allmänna Kvartersanvisningar Sopsug" (technical terminology)
 *
 * Each text has two parts:
 *   1) Kort sammanfattning
 *   2) Utökad förklaring med teknisk kontext från sopsugsystemets uppbyggnad
 */

// ---- Section-level descriptions ----

export const SECTION_INFO = {
  dashboard:
    'Överblick över anläggningens prestanda under den analyserade perioden. ' +
    'KPI-rutorna visar årets viktigaste nyckeltal. ' +
    'Grön = bra, orange = behöver uppmärksamhet, röd = kritiskt.' +
    '\n\n' +
    'Så läser du dashboarden:\n' +
    'Siffrorna ger en snabb bild av anläggningens hälsa. ' +
    'Total energi visar helårsförbrukningen — terminalen förbrukar el via vakuumpumparna varje gång avfall transporteras genom sopsugsledningarna. ' +
    'Medeltillgängligheten bör ligga över 99 %; sjunker den under 98 % finns det sopventiler som behöver underhåll. ' +
    'Totala larm ger en känsla för hur störningsfri driften har varit. ' +
    'Minidiagrammen ger en visuell trend — leta efter stadigt stigande eller fallande mönster.' +
    '\n\n' +
    'Om sopsugsystemet:\n' +
    'Systemet består av inkastpunkter (där boende kastar avfall), sopventiler som separerar lagringsenheten från sopsugsledningen, ' +
    'sektioneringsventiler som isolerar kvartersnät från huvudnätet, och transportluftsventiler som släpper in luft för att skapa vakuumtransport. ' +
    'Avfallet transporteras i rör (Ø400 mm) till en central terminal med vakuumpumpar och containrar.',

  sammanfattning:
    'Sheet1 innehåller anläggningens grundkonfiguration och översiktliga nyckeltal ' +
    'som rapporteras månatligen. Dessa värden är oftast statiska (antal lägenheter, ' +
    'antal ventiler) men kan avslöja förändringar i anläggningens omfattning. ' +
    'Om Min och Max är identiska är värdet konstant under hela året.' +
    '\n\n' +
    'Så läser du sammanfattningen:\n' +
    'Varje rad motsvarar en parameter som rapporteras av styrsystemet. ' +
    'Statiska värden (t.ex. "Antal ventiler = 206" varje månad) bekräftar att anläggningens konfiguration inte ändrats. ' +
    'Om ett värde varierar mellan Min och Max kan det indikera att utrustning lagts till/tagits bort, ' +
    'eller att en parameter fluktuerar (t.ex. drifttryck). ' +
    '\n\n' +
    'Typiska KPI:er inkluderar antal inkastpunkter, antal sopventiler per fraktion, ' +
    'längd på kvartersnät och huvudnät, samt terminaltryck. ' +
    'Avvikelser bör utredas — de kan betyda att en gren tagits ur drift eller att en sensor är felkalibrerad.',

  energi:
    'Energisektionen visar anläggningens totala elförbrukning, hur effektivt energin ' +
    'används per tömning, och hur fraktionsfördelningen ser ut över året. ' +
    'Brytpunkter: Energiförbrukning över 100 000 kWh/månad bör utredas. ' +
    'kWh per tömning under 20 är bra, 20–30 acceptabelt, över 30 ineffektivt.' +
    '\n\n' +
    'Så tolkar du energidata:\n' +
    'Sopsugsanläggningen drivs av vakuumpumpar i terminalen som skapar undertryck i sopsugsledningarna. ' +
    'Varje tömningscykel fungerar så: sopventilen öppnas (≤3 sek), vakuumet suger avfallet genom röret (Ø400 mm), ' +
    'och transportluftsventiler släpper in luft bakom avfallet för att driva det framåt. ' +
    'Energiförbrukningen styrs av antal tömningar, rörlängd och eventuella stopp/omstarter. ' +
    '\n\n' +
    'En minskande energitrend kan bero på optimerade tömningsintervall eller färre störningar. ' +
    'En ökande trend kan indikera läckor i rörsystemet (täthetskravet är 0,4–1,4 l/s beroende på tryck), ' +
    'mekaniska problem eller ineffektiva tömningscykler. ' +
    'Titta särskilt på kWh per tömning — det är det mest rättvisa effektivitetsmåttet ' +
    'eftersom det normaliserar för hur mycket avfall som faktiskt hanteras.',

  fraktioner:
    'Fraktionsanalysen visar hur de olika avfallstyperna beter sig över året — ' +
    'fyllnadstider, genomströmning och säsongsvariation. ' +
    'Brytpunkter: Fyllnadstid över 20 timmar indikerar att containern står full för länge. ' +
    'Genomströmning under 0,5 tömningar/minut är lågt. ' +
    'Stor säsongsvariation (>30%) kan motivera säsongsanpassad tömningsplan.' +
    '\n\n' +
    'Så tolkar du fraktionsdata:\n' +
    'Systemet hanterar tre huvudfraktioner med olika dimensionering: ' +
    'Restavfall (ca 7 liter/dag/lägenhet), Matavfall (ca 0,7 liter) och Plastförpackningar (ca 3,6 liter). ' +
    'Varje fraktion har separata inkastpunkter och sopventiler, så de kan analyseras oberoende. ' +
    '\n\n' +
    'Genomströmning (tömning/minut) visar hur snabbt systemet arbetar — låg genomströmning ' +
    'kan bero på stopp i rör, felaktiga sopventiler eller för lågt vakuumtryck. ' +
    'kWh per tömning per fraktion avslöjar om någon avfallstyp är oproportionerligt energikrävande. ' +
    'Fyllnadstiden visar hur länge lagringsenheten vid inkastpunkten är full innan sopventilen öppnas för tömning. ' +
    'Slutsats: Jämn fördelning och stabil genomströmning tyder på att systemet fungerar som avsett.',

  ventiler:
    'Ventilanalysen visar tillgänglighet och felmönster för alla sopventiler. ' +
    'Varje ventil identifieras med formatet "gren:ventilnr" (t.ex. 24:11 = gren 24, ventil 11). ' +
    'Brytpunkter: Under 95% är kritisk, 95–99% kräver uppmärksamhet, över 99% är bra. ' +
    'Ventiler med över 50 fel/år bör prioriteras för underhåll.' +
    '\n\n' +
    'Så tolkar du ventildata:\n' +
    'En sopventil separerar lagringsenheten (där avfall samlas under inkastpunkten) från sopsugsledningen. ' +
    'Ventilen ska öppna inom 3 sekunder och stänga inom 5 sekunder, och är självlåsande i stängt läge. ' +
    'Varje ventil öppnas och stängs tusentals gånger per år. Tillgänglighet ' +
    'mäter hur stor andel av tiden ventilen fungerar korrekt. ' +
    '\n\n' +
    'Feltyper ger ledtrådar om grundorsaken:\n' +
    '• DOES_NOT_OPEN — Sopventilen kan inte öppnas (mekaniskt/elektriskt fel i cylindern eller ventilhuset)\n' +
    '• DOES_NOT_CLOSE — Ventilen stänger inte ordentligt (slitage, blockering, defekt självlåsning)\n' +
    '• LONG_TIME_SINCE_LAST_COLLECTION — Inget avfall kastats, inte nödvändigtvis fel\n' +
    '• FULL_NOT_EMPTIED — Lagringsenheten är full men tömning sker inte (allvarligt)\n' +
    '• INLET_OPEN — Inkastluckan står öppen (säkerhetsrisk, kan bryta vakuum)\n' +
    '\n' +
    'Fokusera på ventiler med flera feltyper samtidigt — det tyder på systematiskt problem. ' +
    'En ventil som gradvis försämras bör bytas innan den orsakar driftstopp.',

  grenar:
    'Grenanalysen aggregerar ventildata per gren (rörledningssegment i kvartersnätet). ' +
    'Hälsopoängen är ett sammanvägt mått (0–100): ' +
    'tillgänglighet (50%), felfrekvens per ventil (30%) och trend (20%). ' +
    'Under 70 kräver akut åtgärd, 70–85 planerat underhåll, över 85 normal drift. ' +
    'Säsongstyp: "Sommarsvacka" = trafik minskar kraftigt på sommaren (typiskt för skolor). ' +
    '"Jämn" = stabil trafik hela året (bostäder).' +
    '\n\n' +
    'Så tolkar du grendata:\n' +
    'En gren är ett fysiskt rörledningssegment i kvartersnätet med flera inkastpunkter och sopventiler. ' +
    'Kvartersnätet ägs av fastighetsägaren och ansluts till huvudnätet (som drivs av VA-bolaget) via sektioneringsventiler. ' +
    'Grenar som betjänar skolor har ofta kraftigt minskad belastning under juni–augusti, ' +
    'medan bostadsgrenar är jämna hela året. ' +
    '\n\n' +
    'Hälsopoängen viktar tillgänglighet (hur ofta sopventilerna fungerar), ' +
    'felfrekvens (hur ofta problem uppstår per ventil) och trend (om det blir bättre eller sämre). ' +
    'Om flera ventiler på samma gren har problem samtidigt ' +
    'kan grundorsaken vara tryckrelaterad (läcka eller stopp i grenröret) snarare än individuella ventilfel. ' +
    'Rören har en dimensionerad livslängd på 80 år, men materialnötning (ca 8 % från glas/metall i avfallet) ' +
    'kan orsaka lokala problem.',

  manuell:
    'Manuella körningar (MAN_OPEN_CMD) visar hur väl anläggningens automatik fungerar. ' +
    'När en sopventil inte öppnas automatiskt måste en operatör öppna den manuellt. ' +
    'Under 3% manuell andel är normalt, 3–10% bör övervakas, över 10% kräver åtgärd. ' +
    'Ventiler med över 20% manuell andel och 100% tillgänglighet är "dolda risker" — ' +
    'operatörer kompenserar för automatikproblem.' +
    '\n\n' +
    'Så tolkar du manuella körningar:\n' +
    'Systemet ska fungera helt automatiskt: en sensor i inkastpunkten detekterar att lagringsenheten är full, ' +
    'styrsystemet öppnar sopventilen och vakuumet transporterar avfallet till terminalen. ' +
    'Manuella kommandon krävs när denna automatik misslyckas — operatören måste då aktivt trigga tömningen. ' +
    '\n\n' +
    'OBS: En ventil kan ha 100% tillgänglighet men ändå ha hög manuell andel — det betyder ' +
    'att operatören alltid lyckas lösa problemet, men det tar tid och resurser. ' +
    'Dessa "dolda risker" bör prioriteras — om operatören missar en manuell körning ' +
    'kan lagringsenheten bli överfull, inkastluckan blockeras och boende kan inte kasta avfall. ' +
    'Ökande manuell andel över tid indikerar att ett automatikproblem förvärras.',

  larm:
    'Larmsektionen visar larm per månad, uppdelat på kategori (General, Critical, Total stop). ' +
    'General-larm är informativa, Critical kräver uppmärksamhet, Total stop innebär driftstopp. ' +
    'Z-score över 2,0 innebär att larmantalet avviker kraftigt från normalt. ' +
    'Stark korrelation tömningar–larm är vanligt (fler tömningar = fler tillfällen för larm).' +
    '\n\n' +
    'Så tolkar du larmdata:\n' +
    'Styrsystemet loggar händelser i tre allvarlighetsnivåer. General-larm (t.ex. "container full") ' +
    'är normala drifthändelser. Critical-larm (t.ex. "sopventil svarar inte") kräver operatörsåtgärd. ' +
    'Total stop innebär att hela anläggningen eller en gren stått still — ' +
    'sektioneringsventilen kan ha stängt för att isolera ett kvartersnät från huvudnätet. ' +
    '\n\n' +
    'Jämförelsen med föregående år visar om larmnivån förbättrats eller försämrats. ' +
    'Januarispikar är vanliga efter julledighet — ansamlat avfall genererar många tömningar och larm. ' +
    'En stabil eller minskande larmtrend är positiv. Plötsliga ökningar bör ' +
    'utredas snabbt — de kan indikera nya problem som riskerar att eskalera till driftstopp.',

  trender:
    'Trendanalysen visar statistiska trender och samband. ' +
    'Trendlinje med R² nära 1 = stark trend. MA(3) = glidande medelvärde som jämnar ut variationer. ' +
    'Korrelation: Pearson r nära +1 eller −1 = starkt samband, nära 0 = inget samband. ' +
    'Anomalier: datapunkter som avviker kraftigt från normalt (z-score > 2).' +
    '\n\n' +
    'Så tolkar du trenddata:\n' +
    'Trendlinjen (linjär regression) visar den övergripande riktningen. ' +
    'R²-värdet anger hur väl trendlinjen förklarar variationen: ' +
    'R²=0,9 betyder att 90% av variationen förklaras av trenden. ' +
    'MA(3) (glidande medelvärde, 3 månader) jämnar ut korttidsvariationer. ' +
    '\n\n' +
    'Korrelationsanalysen avslöjar samband: t.ex. om energi och tömningar har stark positiv ' +
    'korrelation (r>0,8) betyder det att energiförbrukningen drivs av tömningsvolymen, ' +
    'inte av ineffektivitet i vakuumsystemet. ' +
    'Anomalier (z>2) pekar ut enskilda datapunkter som sticker ut och bör utredas.',

  drifterfarenheter:
    'Denna sektion korsrefererar data från flera källor: felkoder, manuella ingrepp, ' +
    'energiförbrukning och larm för att identifiera rotorsaker och dolda risker. ' +
    'Riskventiler har hög manuell andel men 100% tillgänglighet — de ser bra ut ' +
    'i statistiken men är beroende av att operatörer aktivt kompenserar. ' +
    'DOES_NOT_OPEN är typiskt den starkast drivande feltypen för manuella ingrepp.' +
    '\n\n' +
    'Så tolkar du drifterfarenheter:\n' +
    'Sektionen letar efter samband som inte syns i enskilda analyser. ' +
    'En sopventil kan ha perfekt tillgänglighet men ändå vara problematisk ' +
    'om den kräver konstanta manuella ingrepp — sopventilens automatik (sensor → styrsystem → ventilöppning) ' +
    'fungerar inte men operatören kompenserar varje gång. ' +
    '\n\n' +
    'Korrelationen manuella ingrepp vs feltyper visar vilka typer av fel som driver ' +
    'behovet av manuell kompensation. Om DOES_NOT_OPEN har hög korrelation (r>0,5) ' +
    'med manuella kommandon innebär det att sopventiler som inte öppnar automatiskt ' +
    'kompenseras manuellt istället för att åtgärdas. ' +
    'Riskventiler är de viktigaste att åtgärda — de döljer sig bakom bra statistik ' +
    'men utgör en sårbarhet om operatören är frånvarande.',

  rekommendationer:
    'Rekommendationerna är automatiskt genererade baserat på alla föregående analyser. ' +
    'Prio 1 (AKUT) kräver omedelbar åtgärd, Prio 2 (HÖG) inom 1–3 månader, ' +
    'Prio 3 (MEDEL) planera in nästa kvartal, Prio 4 (LÅG) längre sikt/optimering. ' +
    'Varje rekommendation innehåller dataunderlag, förväntad effekt och konkreta åtgärder.' +
    '\n\n' +
    'Så använder du rekommendationerna:\n' +
    'Börja alltid med Prio 1 — dessa har identifierats som akuta baserat på ' +
    'tröskelvärden (t.ex. sopventil under 95% tillgänglighet, gren med hälsopoäng under 70). ' +
    '\n\n' +
    'Strategiska mål (KPI-tabellen) ger konkreta mätbara mål för 3, 6 och 12 månader. ' +
    'Operatörsagendan sammanfattar de viktigaste åtgärderna i en prioriterad lista. ' +
    '\n\n' +
    'Kvartalsfokus:\n' +
    '• Q1: Akuta åtgärder — åtgärda kritiska sopventiler och grenar, installera förstärkt övervakning\n' +
    '• Q2: Optimering — implementera energibesparingsåtgärder, utvärdera effekt av Q1-åtgärder\n' +
    '• Q3: Konsolidering — dokumentera framgångsrika metoder, sprida best practice till alla grenar\n' +
    '• Q4: Uppföljning — årsutvärdering mot KPI:er, planera nästa år baserat på resultat\n' +
    '\n' +
    'Behandla Prio 1 och 2 som er underhållsplan för närmaste kvartalet. ' +
    'Följ upp mot KPI-målen månadsvis för att se om åtgärderna ger önskad effekt.',
}

// ---- Chart-level descriptions ----

export const CHART_INFO = {
  // Dashboard
  'Energi per månad':
    'Total elförbrukning per månad. Minskande trend är positivt.' +
    '\n\n' +
    'Varje stapel visar total kWh för en månad. Terminalen förbrukar mest el via vakuumpumparna — ' +
    'ju fler tömningscykler som körs, desto mer energi krävs. ' +
    'Högre staplar vintertid kan bero på fler tömningar (folk hemma mer) ' +
    'eller kall väderlek som påverkar pumpeffektiviteten. ' +
    'Leta efter en generellt minskande trend — det indikerar att systemet blir effektivare.',

  'Tillgänglighet per månad':
    'Genomsnittlig sopventiltillgänglighet. Över 99% är bra.' +
    '\n\n' +
    'Linjen visar medelvärdet av alla sopventilers tillgänglighet varje månad. ' +
    'Eftersom de flesta ventiler fungerar bra (>99%) kan även små förändringar i medelvärdet ' +
    'dölja att enskilda ventiler har allvarliga problem. ' +
    'Om medeltillgängligheten sjunker under 98% bör man titta på de ' +
    'individuella ventilerna — det betyder att ett fåtal sopventiler drar ner snittet kraftigt.',

  'Larm per månad':
    'Totalt antal larm. Spikar bör utredas.' +
    '\n\n' +
    'Varje stapel visar totala larm för en månad, oavsett allvarlighetsgrad. ' +
    'En jämn larmnivå tyder på stabil drift. Plötsliga spikar kan bero på ' +
    'ansamlat avfall i lagringsenheter, sektioneringsventiler som stängt, eller förändringar i driften. ' +
    'Jämför med tömningsvolymen — om larm ökar i takt med tömningar är det normalt.',

  'Fraktioner per månad':
    'Tömningar uppdelat per avfallstyp (stacked).' +
    '\n\n' +
    'Det staplade diagrammet visar fördelningen mellan fraktioner: ' +
    'Restavfall (ca 7 L/dag/lägenhet), Matavfall (ca 0,7 L) och Plastförpackningar (ca 3,6 L). ' +
    'Totalhöjden per månad visar den totala tömningsvolymen. ' +
    'En stabil fördelning tyder på normala avfallsmönster. Om en fraktion ' +
    'plötsligt ökar eller minskar kan det bero på ändrade sorteringsrutiner, ' +
    'ny bebyggelse eller sopventiler ur drift för en fraktion.',

  // Energi
  'Energiförbrukning per månad (kWh)':
    'Total elförbrukning. Över 100 000 kWh/mån bör utredas.' +
    '\n\n' +
    'Diagrammet visar anläggningens totala elförbrukning per månad i kilowattimmar (kWh). ' +
    'Vakuumpumparna i terminalen står för merparten av förbrukningen. ' +
    'Varje tömningscykel kräver att pumparna bygger upp tillräckligt undertryck i sopsugsledningarna ' +
    'för att transportera avfallet — rörlängd (Ø400 mm), antal böjar och höjdskillnader påverkar energiåtgången. ' +
    '\n\n' +
    'En månad med hög energi men normalt antal tömningar indikerar ineffektivitet ' +
    '— orsaker kan vara läckor (pumpen jobbar mer för att hålla vakuum, täthetskravet är 0,4–1,4 l/s), ' +
    'slitna packningar eller suboptimala tömningsintervall som kräver fler omstarter.',

  'Tömningar per fraktion (stacked)':
    'Staplat diagram som visar volym och säsongsvariation per fraktion.' +
    '\n\n' +
    'Varje färgsegment representerar en avfallsfraktion. ' +
    'Rest (hushållsavfall) genererar flest tömningar och är jämnast. ' +
    'Mat (organiskt) kan variera med årstid — mer matavfall under varmare månader. ' +
    'Plast (förpackningar) följer konsumentbeteende. ' +
    '\n\n' +
    'Om en fraktion försvinner eller minskar kraftigt kan det bero på ' +
    'att sopventiler för den fraktionen är ur drift, eller att sorteringsreglerna ändrats.',

  'Drifttid per månad (h)':
    'Anläggningens aktiva drifttid. Korrelerar normalt med energiförbrukning.' +
    '\n\n' +
    'Linjen visar antal timmar per månad som vakuumsystemet i terminalen varit aktivt. ' +
    'Drifttiden inkluderar alla tömningscykler — från det att en sopventil öppnas ' +
    'till att avfallet nått terminalen och vakuumet återställts. ' +
    '\n\n' +
    'Drifttid och energi bör följa varandra. Om energin ökar men drifttiden ' +
    'inte gör det tyder det på att pumparna jobbar hårdare per timme (möjlig ineffektivitet). ' +
    'Om drifttiden ökar men tömningarna inte gör det kan det bero på längre cykeltider, ' +
    'vilket ofta pekar på stopp eller blockering i sopsugsledningarna.',

  // Fraktioner
  'Genomströmning (tömning/minut)':
    'Hur snabbt tömningscykeln går. Högre = bättre, under 0,5 är lågt.' +
    '\n\n' +
    'Genomströmning mäter hur effektivt systemet tömmer lagringsenheter — antal tömningar dividerat ' +
    'med aktiv tömtid i minuter. Varje fraktion har sin egen linje. ' +
    'Variationer beror på avfallets densitet (organiskt väger mer per volym), ' +
    'rörlängd till terminalen och systemets skick. ' +
    '\n\n' +
    'Sjunkande genomströmning för en fraktion indikerar att transporten ' +
    'blir långsammare — möjliga orsaker: delvis blockerade sopsugsledningar, ' +
    'slitna packningar i sopventiler, lägre vakuumtryck, eller att transportluftsventilerna inte fungerar optimalt.',

  'Energieffektivitet per fraktion (kWh/tömning)':
    'Visar vilka fraktioner som är mest energikrävande per tömning.' +
    '\n\n' +
    'Diagrammet visar hur mycket energi (kWh) varje enskild tömning kostar per fraktion. ' +
    'Fraktioner med tyngre avfall kräver normalt mer energi. ' +
    'Restavfall kan innehålla glas och metall som nöter rören (ca 8 % materialnötning), ' +
    'vilket långsiktigt kan påverka transporteffektiviteten. ' +
    '\n\n' +
    'Stabila eller sjunkande värden är bra. Stigande kWh/tömning ' +
    'för en fraktion kan bero på mekaniska problem i den del av systemet som hanterar ' +
    'den fraktionen, eller att avfallets karaktär ändrats.',

  'Tömnings-heatmap (fraktion × månad)':
    'Mörka rutor = månader med många tömningar.' +
    '\n\n' +
    'Heatmappen visar tömningsvolym per fraktion (Y-axel) och månad (X-axel). ' +
    'Färgskalan går från ljust (få tömningar) till mörkt (många). ' +
    'Mönstret avslöjar säsongsrytmer per fraktion — t.ex. om Mat har ' +
    'mörka rutor på sommaren (mer matavfall) eller om Rest är jämnt mörk hela året. ' +
    'Ljusa "hål" i en annars mörk rad bör utredas — de kan indikera att ' +
    'sopventiler för den fraktionen var ur drift under den perioden.',

  'Sommar vs vinter per fraktion':
    'Stor skillnad kan motivera säsongsanpassad tömningsplan.' +
    '\n\n' +
    'Diagrammet jämför genomsnittligt antal tömningar per fraktion under sommar ' +
    '(juni–augusti) respektive vinter (december–februari). ' +
    'Om en fraktion har >30% skillnad kan det vara lönsamt att anpassa tömningsfrekvensen ' +
    'efter säsong — t.ex. kan skolgrenar ha kraftigt minskad organisk fraktion under sommaren. ' +
    'Dimensioneringsnormen (7 L/dag Rest, 0,7 L Mat, 3,6 L Plast per lägenhet) ' +
    'är ett årsmedel — faktisk volym varierar med säsong.',

  // Ventiler
  'Tillgänglighet per månad (medel/min/max)':
    'Blå linje = medeltillgänglighet. Ljusblått band = min–max-spridning. ' +
    'Smalt band = stabil drift, brett band = stor variation.' +
    '\n\n' +
    'Den blå linjen visar genomsnittlig tillgänglighet för alla sopventiler per månad. ' +
    'Det ljusblå bandet visar intervallet från sämsta till bästa ventil. ' +
    '\n\n' +
    'Om medelvärdet är stabilt (>99%) men bandet är brett nedåt (min drar ner ' +
    'till t.ex. 80%) finns det enskilda sopventiler med allvarliga problem. ' +
    'Om både medelvärde och minimum sjunker samtidigt finns ett systemproblem ' +
    '(t.ex. tryckrelaterat i huvudnätet) som påverkar många ventiler.',

  'Feltyper per månad (stacked)':
    'LONG_TIME_SINCE_LAST_COLLECTION är vanligast men minst kritisk. ' +
    'DOES_NOT_OPEN och DOES_NOT_CLOSE är kritiska mekaniska fel.' +
    '\n\n' +
    'Det staplade diagrammet visar fördelningen av feltyper per månad:\n' +
    '• LONG_TIME_SINCE_LAST_COLLECTION — Inget avfall kastats på länge (normalt under lov/semester)\n' +
    '• DOES_NOT_OPEN — Sopventilen kan inte öppnas (mekaniskt/elektriskt fel i cylinder eller ventilhus)\n' +
    '• DOES_NOT_CLOSE — Ventilen stänger inte inom 5 sek (slitage, blockering, defekt självlåsning)\n' +
    '• FULL_NOT_EMPTIED — Lagringsenheten full men tömning sker inte (allvarligt — avfall ackumuleras)\n' +
    '• INLET_OPEN — Inkastluckan vid inkastpunkten står öppen (säkerhetsrisk, bryter vakuum)',

  '10 sämsta ventilerna (tillgänglighet)':
    'Individuella trender för de sämsta sopventilerna. Nedåttrend kräver åtgärd.' +
    '\n\n' +
    'Varje linje följer en av de sämsta sopventilerna (lägst genomsnittlig tillgänglighet) ' +
    'genom årets alla månader. ' +
    '\n\n' +
    'Ventiler med stabil låg tillgänglighet har kroniska problem — ' +
    'sopventilens mekanik (cylinder, ventilhus, packningar) behöver reparation eller byte. ' +
    'Ventiler med plötsligt tapp har fått ett nytt problem. ' +
    'Ventiler vars kurva svänger uppåt har förbättrats — kontrollera om en reparation gjordes.',

  'Tillgänglighetsfördelning (histogram)':
    'Visar att de flesta ventiler har hög tillgänglighet. Fokusera på svansen till vänster.' +
    '\n\n' +
    'Histogrammet visar hur många sopventiler som faller i varje procent-intervall. ' +
    'En välfungerande anläggning har nästan alla staplar långt till höger (nära 100%). ' +
    'Staplar till vänster (<95%) representerar problemventiler som bör ' +
    'prioriteras för underhåll. Om det finns en "svans" ner mot 80–90% ' +
    'finns det en grupp ventiler med systematiska problem.',

  // Grenar
  'Tillgänglighet per gren × månad (heatmap)':
    'Färgskala: grön (>99.5%) = utmärkt, lime (>99%) = bra, gul (>98%) = acceptabelt, ' +
    'orange (>95%) = uppmärksamhet, röd (<95%) = kritiskt.' +
    '\n\n' +
    'Heatmappen ger en komplett överblick av alla grenars prestanda i kvartersnätet genom hela året. ' +
    'Varje rad är en gren (rörledningssegment med sopventiler), varje kolumn en månad. ' +
    '\n\n' +
    'Grenar med genomgående gröna rutor fungerar bra. ' +
    'Grenar med enstaka gula/orange rutor kan ha haft tillfälliga problem. ' +
    'Grenar med genomgående orange/röda rutor har kroniska problem. ' +
    'Mönster i kolumner (samma månad dålig för många grenar) kan indikera ett systemproblem ' +
    '(t.ex. tryckfall i huvudnätet som påverkar alla anslutna kvartersnät).',

  'Hälsopoäng per gren':
    'Sammanvägt mått: tillgänglighet (50%) + felfrekvens (30%) + trend (20%). ' +
    'Röd <70 (kritisk), orange 70–85 (åtgärd), grön >85 (bra).' +
    '\n\n' +
    'Hälsopoängen kombinerar tre dimensioner till en siffra:\n' +
    '• Tillgänglighet (50%) — Hur ofta grenens sopventiler fungerar\n' +
    '• Felfrekvens per ventil (30%) — Antal fel normaliserat per sopventil (rättvis jämförelse oavsett grenstorlek)\n' +
    '• Trend (20%) — Om det blir bättre eller sämre (en gren som förbättras får bonus)\n' +
    '\n' +
    'Sortera listan för att snabbt se vilka grenar som är sämst. ' +
    'Grenar under 70 bör inspekteras fysiskt — kontrollera sopventiler, sopsugsledningens skick ' +
    'och eventuella läckor vid sektioneringsventilen.',

  'Grentyper (fördelning)':
    'Klassificering baserad på Info-fält: Skola, Kontor, Bostäder, Övrigt.' +
    '\n\n' +
    'Tårtdiagrammet visar fördelningen av grentyper. ' +
    'Grentypen påverkar hur man tolkar data — skolgrenar har naturligt säsongsvariation ' +
    'medan bostadsgrenar (som dimensioneras efter antal lägenheter) förväntas vara stabila. ' +
    'Om bostäder dominerar bör variationen vara låg. ' +
    'Om skolor utgör en stor andel förklarar det säsongsmönster i energi och tömningar.',

  'Feltrend topp-5 sämsta grenar':
    'Ökande trender kräver åtgärd.' +
    '\n\n' +
    'Linjediagrammet visar totala fel per månad för de 5 grenar med lägst hälsopoäng. ' +
    'Grenar med stadigt ökande felantal har problem som förvärras — ' +
    'dessa bör prioriteras högst, möjligen krävs inspektion av sopsugsledningen med kamera. ' +
    'Grenar vars kurva sjunker visar förbättring, ' +
    'vilket kan bekräfta att en genomförd reparation haft effekt.',

  // Manuell
  'Automatiska vs manuella kommandon (stacked)':
    'Blå = automatiska, lila = manuella. Höga lila staplar indikerar automatikproblem.' +
    '\n\n' +
    'Det staplade diagrammet visar totala öppningskommandon per månad. ' +
    'I normalfallet triggas öppning automatiskt av styrsystemet (via MQTT-kommunikation) ' +
    'när sensorn detekterar att lagringsenheten vid inkastpunkten är full. ' +
    'Den lila andelen (MAN_OPEN_CMD) visar manuella ingrepp av operatörer. ' +
    '\n\n' +
    'Den lila andelen bör vara liten (<3% av totalen). ' +
    'Om den ökar gradvis förvärras automatikproblem. ' +
    'Om den ökar plötsligt en månad kan det bero på en specifik incident ' +
    '(t.ex. en gren vars sektioneringsventil stängt och kräver manuellt ingripande).',

  'Manuell andel per månad (%)':
    'Under 3% normalt, 3–10% bevakning, över 10% åtgärd. Minskande trend är positivt.' +
    '\n\n' +
    'Linjen visar procentandelen manuella kommandon av alla kommandon per månad. ' +
    'En stabil kurva under 3% innebär att automatiken fungerar bra. ' +
    'Värden över 5% bör utredas — identifiera vilka sopventiler som driver den manuella andelen. ' +
    'En sjunkande trend indikerar att underhåll ger effekt. ' +
    'En stigande trend kräver åtgärd innan operatörerna blir överbelastade.',

  'Topp-15 ventiler (manuell%)':
    'Röd >50%, orange >20%, grön <20%. Ventiler med hög manuell% + 100% tillgänglighet = dold risk.' +
    '\n\n' +
    'Horisontella staplar visar sopventilerna med högst manuell andel. ' +
    'Färgkodning: Röd = över 50% (operatören gör halva jobbet), Orange = 20–50%, Grön = under 20%. ' +
    '\n\n' +
    'Sopventiler i rött och orange bör inspekteras — sensorn i inkastpunkten eller ' +
    'styrsystemets logik fungerar troligen inte korrekt. ' +
    'OBS: En ventil med hög manuell andel men 100% tillgänglighet är en "dold risk" — ' +
    'operatören kompenserar, men om hen missar en tömning kan lagringsenheten ' +
    'bli överfull och avfallet kan inte kastas.',

  // Larm
  'MA(3) + trendlinje':
    'Orange = glidande medelvärde (3 mån), grå = linjär trendlinje. ' +
    'Ökande trend kräver utredning.' +
    '\n\n' +
    'MA(3) (Moving Average 3 månader) jämnar ut korttidsvariationer genom att visa ' +
    'medelvärdet av de senaste 3 månaderna. Den grå trendlinjen visar den statistiska trenden ' +
    'för hela perioden. ' +
    '\n\n' +
    'Om MA(3) ligger under trendlinjen i slutet av perioden förbättras situationen. ' +
    'Om MA(3) ligger över trendlinjen försämras den. ' +
    'Larm kan genereras av alla delar i systemet: sopventiler, sektioneringsventiler, ' +
    'transportluftsventiler och terminalen.',

  'Aktuell period vs föregående år':
    'Lägre staplar än föregående år är positivt.' +
    '\n\n' +
    'Det grupperade diagrammet jämför larmantal per månad mellan aktuell period (röd) och ' +
    'föregående år (grå). ' +
    'Om de röda staplarna konsekvent är lägre har larmfrekvensen förbättrats. ' +
    'Jämför mönstret — om samma månader är höga båda åren (t.ex. januari) ' +
    'kan det vara ett säsongsrelaterat mönster snarare än en försämring.',

  // Trend
  // Larm (extra)
  'Larm per kategori (årstotal)':
    'Visar totalt antal larm per kategori summerat över hela den analyserade perioden.' +
    '\n\n' +
    'Staplarna visar hur larmvolymen fördelar sig mellan kategorierna General, Critical och Total stop. ' +
    'General-larm (t.ex. "container full", "lång tid sedan tömning") är normala drifthändelser som inte kräver akut åtgärd. ' +
    'Critical-larm (t.ex. "sopventil svarar inte", "full ej tömd") kräver operatörsåtgärd. ' +
    'Total stop innebär att en gren eller hela anläggningen stått still. ' +
    '\n\n' +
    'Om Critical eller Total stop utgör en stor andel av totalen bör man undersöka vilka grenar och ventiler som genererar dessa larm. ' +
    'En hög andel General-larm är normalt — de är informativa och visar att styrsystemet övervakar korrekt.',

  // Gren (extra)
  'Manuell andel per gren':
    'Visar hur stor andel av alla öppningskommandon per gren som är manuella.' +
    '\n\n' +
    'Varje stapel representerar en gren i kvartersnätet. Värdet anger procentandelen manuella ' +
    'kommandon (MAN_OPEN_CMD) av alla öppningskommandon (manuella + automatiska). ' +
    'Grenar med hög manuell andel har sopventiler vars automatik inte fungerar korrekt — ' +
    'operatörer måste aktivt trigga tömningar istället för att de sker automatiskt. ' +
    '\n\n' +
    'Under 3% är normalt, 3–10% bör övervakas, över 10% kräver åtgärd. ' +
    'Om en hel gren har hög manuell andel kan problemet vara i styrsystemets logik ' +
    'eller kommunikation (MQTT) snarare än i enskilda sopventiler. ' +
    'Jämför med hälsopoängen — en gren kan ha bra hälsa men hög manuell andel ' +
    'om operatörerna kompenserar effektivt.',

  'Sommar vs vinter per gren (kommandon)':
    'Jämför totala öppningskommandon under sommar respektive vinter för varje gren.' +
    '\n\n' +
    'Diagrammet visar två staplar per gren: orange för sommar (juni–augusti) och blå för vinter (december–februari). ' +
    'Grenar som betjänar skolor har ofta kraftigt minskad aktivitet under sommaren (lov), ' +
    'medan bostadsgrenar är relativt jämna. ' +
    '\n\n' +
    'Stor skillnad mellan sommar och vinter kan motivera säsongsanpassad drift — ' +
    't.ex. längre tömningsintervall under sommarlov för skolgrenar, ' +
    'eller reducerad övervakning under perioder med låg aktivitet. ' +
    'Grenar som borde vara jämna (bostäder) men visar stor variation kan ha ett underliggande problem.',

  'Sammanfattning — månatlig variation':
    'Visar hur detta nyckeltal varierar mellan månader under den analyserade perioden.' +
    '\n\n' +
    'Varje stapel representerar en månad. Om alla staplar är identiska är värdet konstant ' +
    '(t.ex. antal ventiler, antal lägenheter) — det bekräftar att anläggningens konfiguration inte ändrats. ' +
    '\n\n' +
    'Om värdet varierar kan det bero på:\n' +
    '• Utrustning som lagts till eller tagits ur drift\n' +
    '• Säsongsberoende parametrar (t.ex. drifttryck, temperaturberoende mätningar)\n' +
    '• Sensorfel eller felkalibrering\n' +
    '\n' +
    'Plötsliga hopp bör utredas — de kan indikera att en förändring gjorts i anläggningen ' +
    'eller att en sensor rapporterar felaktigt.',

  // Trend
  'Energi + MA(3) + trendlinje (kWh)':
    'Gul = faktisk energi, orange = MA(3), grå = trendlinje. ' +
    'Minskande trend (R² nära 1) innebär systematisk minskning.' +
    '\n\n' +
    'Tre linjer i ett diagram:\n' +
    '• Gul = faktisk energiförbrukning per månad (vakuumpumpar i terminalen)\n' +
    '• Orange = MA(3), glidande medelvärde som jämnar ut variationer\n' +
    '• Grå = linjär trendlinje (bästa raka linje genom data)\n' +
    '\n' +
    'Om trendlinjen pekar nedåt med högt R² (>0,7) minskar energin systematiskt. ' +
    'Titta på var MA(3) slutar jämfört med där den började — det visar den reella ' +
    'förändringen utan att påverkas av enskilda extremmånader.',

  'kWh per tömning + MA(3)':
    'Energieffektivitet — lägre värde = bättre. Under 20 bra, 20–30 ok, >30 ineffektivt.' +
    '\n\n' +
    'Detta är det viktigaste effektivitetsmåttet — det visar hur mycket energi ' +
    'varje enskild tömningscykel kostar, normaliserat för volymförändringar. ' +
    'Varje tömning innebär att vakuumpumparna bygger undertryck, sopventilen öppnas, ' +
    'transportluftsventiler släpper in luft, och avfallet transporteras genom sopsugsledningen till terminalen. ' +
    '\n\n' +
    'Stigande kWh/tömning trots stabila tömningsvolymer indikerar att systemet ' +
    'förbrukar mer energi per cykel — möjliga orsaker: läckor i vakuumsystemet, ' +
    'slitage på pumpar, blockerade rör som kräver längre pumpning. ' +
    'Detta mått bör följas upp månadsvis som en tidig varningsindikator.',

  'Energi vs tömningar (scatter)':
    'Stark korrelation (r>0,7) är normalt. Punkter långt från linjen kan indikera anomalier.' +
    '\n\n' +
    'Scatter-plottet visar varje månad som en punkt med tömningar (X) och energi (Y). ' +
    'Den streckade linjen är en regressionslinje. ' +
    '\n\n' +
    'Punkter nära linjen = normal korrelation (mer tömningar = mer pumpenergi, proportionellt). ' +
    'Punkter ovanför linjen = månader med oproportionerligt hög energi (ineffektivitet — ' +
    'möjliga läckor i sopsugsledningen, slitna packningar, tryckförluster). ' +
    'Punkter under linjen = månader med ovanligt hög effektivitet. ' +
    'Om alla punkter ligger tätt = stark och stabil korrelation (r>0,9).',
}
