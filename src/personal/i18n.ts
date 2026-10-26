import type { Lang, Prefs } from "./types";

/* =====================================================================
   Languages. The app shell, navigation, lock screen and personal space
   are translated here; Overeo SI answers in her language (Xevyo is asked
   to reply in it). Educational articles stay in English for now and are
   marked so. Translations are first drafts — have a native, clinically
   aware reviewer check them before launch in each market.
   ===================================================================== */

export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
  { id: "pt", label: "Portuguese", native: "Português" },
  { id: "de", label: "German", native: "Deutsch" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
  { id: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { id: "zh", label: "Chinese", native: "中文" },
];

export const DEFAULT_PREFS: Prefs = { lang: "en", discreet: false, lock: null, notifications: false, units: { temp: "C", weight: "kg" } };

const EN = {
  "nav.home": "Home",
  "nav.today": "Today",
  "nav.track": "Track",
  "nav.si": "Ask SI",
  "nav.agents": "Agents",
  "nav.me": "Me",
  "nav.signals": "Signals",
  "nav.tests": "Tests",
  "nav.care": "Care",
  "nav.more": "More",
  "nav.myspace": "My space",
  "space.sample": "Sample · Maya",
  "space.mine": "My space",
  "space.sampleNote": "You're viewing Maya's sample. Nothing here is real.",
  "space.create": "Create my space",
  "space.switchMine": "Switch to my space",
  "space.switchSample": "View Maya's sample",
  "today.hello": "Hi",
  "today.day": "Cycle day",
  "today.nextPeriod": "Next period",
  "today.inDays": "in {n} days",
  "today.learning": "How well OVEREO knows you",
  "today.inbox": "Waiting for you",
  "today.nothing": "Nothing needs you right now.",
  "today.reminders": "Coming up",
  "today.learned": "What I've noticed",
  "today.quickLog": "Quick log",
  "today.recap": "Your week",
  "track.title": "Track",
  "track.sub": "Two taps. Everything you add teaches OVEREO about you.",
  "track.snap": "Snap a report",
  "track.recent": "Recent entries",
  "track.saved": "Saved",
  "track.period": "Period",
  "track.symptom": "Symptoms",
  "track.mood": "Mood",
  "track.sleep": "Sleep",
  "track.bp": "Blood pressure",
  "track.temp": "Temperature",
  "track.meds": "Medicine",
  "track.weight": "Weight",
  "track.lab": "Lab result",
  "agents.title": "Your agents",
  "agents.sub": "Each one has one job. They suggest — you decide.",
  "agents.may": "May",
  "agents.never": "Never",
  "agents.often": "How often",
  "agents.on": "On",
  "agents.off": "Paused",
  "inbox.title": "Inbox",
  "inbox.approve": "Yes, do it",
  "inbox.edit": "Change",
  "inbox.dismiss": "Not for me",
  "inbox.later": "Later",
  "inbox.why": "Why?",
  "diary.title": "Diary",
  "diary.sub": "Everything your agents did — and everything you told them.",
  "me.title": "Me",
  "me.knows": "What OVEREO knows about me",
  "me.knowsSub": "Everything it has learned, in plain words. Correct or forget anything.",
  "me.forget": "Forget",
  "me.correct": "Correct",
  "me.tell": "Tell OVEREO something",
  "me.settings": "Settings",
  "me.language": "Language",
  "me.discreet": "Discreet mode",
  "me.discreetSub": "Neutral notifications and a private-looking screen.",
  "me.lock": "App lock",
  "me.lockSub": "Ask for a PIN when OVEREO opens.",
  "me.notifications": "Notifications",
  "me.export": "Export my data",
  "me.delete": "Delete my space",
  "me.signout": "Sign out",
  "me.explore": "Explore OVEREO",
  "lock.title": "OVEREO is locked",
  "lock.enter": "Enter your PIN",
  "lock.wrong": "That PIN didn't match",
  "lock.forgot": "Forgot PIN",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.done": "Done",
  "common.back": "Back",
  "common.next": "Next",
  "common.today": "Today",
  "common.offline": "You're offline — everything you log is saved on this device.",
  "common.englishOnly": "This article is in English for now.",
} as const;

export type TKey = keyof typeof EN;
type Dict = Partial<Record<TKey, string>>;

const ES: Dict = {
  "nav.home": "Inicio", "nav.today": "Hoy", "nav.track": "Registrar", "nav.si": "Preguntar", "nav.agents": "Agentes", "nav.me": "Yo", "nav.signals": "Señales", "nav.tests": "Pruebas", "nav.care": "Atención", "nav.more": "Más", "nav.myspace": "Mi espacio",
  "space.sample": "Ejemplo · Maya", "space.mine": "Mi espacio", "space.sampleNote": "Estás viendo el ejemplo de Maya. Nada de esto es real.", "space.create": "Crear mi espacio", "space.switchMine": "Ir a mi espacio", "space.switchSample": "Ver el ejemplo de Maya",
  "today.hello": "Hola", "today.day": "Día del ciclo", "today.nextPeriod": "Próximo periodo", "today.inDays": "en {n} días", "today.learning": "Cuánto te conoce OVEREO", "today.inbox": "Te espera", "today.nothing": "Nada te necesita ahora.", "today.reminders": "Próximamente", "today.learned": "Lo que he notado", "today.quickLog": "Registro rápido", "today.recap": "Tu semana",
  "track.title": "Registrar", "track.sub": "Dos toques. Todo lo que añades enseña a OVEREO sobre ti.", "track.snap": "Foto de un informe", "track.recent": "Entradas recientes", "track.saved": "Guardado", "track.period": "Periodo", "track.symptom": "Síntomas", "track.mood": "Ánimo", "track.sleep": "Sueño", "track.bp": "Presión arterial", "track.temp": "Temperatura", "track.meds": "Medicamento", "track.weight": "Peso", "track.lab": "Resultado de laboratorio",
  "agents.title": "Tus agentes", "agents.sub": "Cada uno tiene una tarea. Ellos sugieren; tú decides.", "agents.may": "Puede", "agents.never": "Nunca", "agents.often": "Frecuencia", "agents.on": "Activo", "agents.off": "En pausa",
  "inbox.title": "Bandeja", "inbox.approve": "Sí, hazlo", "inbox.edit": "Cambiar", "inbox.dismiss": "No es para mí", "inbox.later": "Luego", "inbox.why": "¿Por qué?",
  "diary.title": "Diario", "diary.sub": "Todo lo que hicieron tus agentes y todo lo que les dijiste.",
  "me.title": "Yo", "me.knows": "Lo que OVEREO sabe de mí", "me.knowsSub": "Todo lo que ha aprendido, en palabras sencillas. Corrige u olvida lo que quieras.", "me.forget": "Olvidar", "me.correct": "Corregir", "me.tell": "Cuéntale algo a OVEREO", "me.settings": "Ajustes", "me.language": "Idioma", "me.discreet": "Modo discreto", "me.discreetSub": "Notificaciones neutras y una pantalla discreta.", "me.lock": "Bloqueo", "me.lockSub": "Pedir un PIN al abrir OVEREO.", "me.notifications": "Notificaciones", "me.export": "Exportar mis datos", "me.delete": "Eliminar mi espacio", "me.signout": "Cerrar sesión", "me.explore": "Explorar OVEREO",
  "lock.title": "OVEREO está bloqueado", "lock.enter": "Introduce tu PIN", "lock.wrong": "El PIN no coincide", "lock.forgot": "Olvidé mi PIN",
  "common.save": "Guardar", "common.cancel": "Cancelar", "common.done": "Listo", "common.back": "Atrás", "common.next": "Siguiente", "common.today": "Hoy", "common.offline": "Sin conexión: todo lo que registres se guarda en este dispositivo.", "common.englishOnly": "Este artículo está en inglés por ahora.",
};
const FR: Dict = {
  "nav.home": "Accueil", "nav.today": "Aujourd'hui", "nav.track": "Suivre", "nav.si": "Demander", "nav.agents": "Agents", "nav.me": "Moi", "nav.signals": "Signaux", "nav.tests": "Analyses", "nav.care": "Soins", "nav.more": "Plus", "nav.myspace": "Mon espace",
  "space.sample": "Exemple · Maya", "space.mine": "Mon espace", "space.sampleNote": "Vous consultez l'exemple de Maya. Rien n'est réel.", "space.create": "Créer mon espace", "space.switchMine": "Aller à mon espace", "space.switchSample": "Voir l'exemple de Maya",
  "today.hello": "Bonjour", "today.day": "Jour du cycle", "today.nextPeriod": "Prochaines règles", "today.inDays": "dans {n} jours", "today.learning": "Ce qu'OVEREO sait de vous", "today.inbox": "En attente", "today.nothing": "Rien ne vous attend pour l'instant.", "today.reminders": "À venir", "today.learned": "Ce que j'ai remarqué", "today.quickLog": "Saisie rapide", "today.recap": "Votre semaine",
  "track.title": "Suivre", "track.sub": "Deux touches. Chaque saisie apprend à OVEREO à vous connaître.", "track.snap": "Photographier un résultat", "track.recent": "Saisies récentes", "track.saved": "Enregistré", "track.period": "Règles", "track.symptom": "Symptômes", "track.mood": "Humeur", "track.sleep": "Sommeil", "track.bp": "Tension", "track.temp": "Température", "track.meds": "Médicament", "track.weight": "Poids", "track.lab": "Résultat d'analyse",
  "agents.title": "Vos agents", "agents.sub": "Chacun a une seule tâche. Ils proposent, vous décidez.", "agents.may": "Peut", "agents.never": "Jamais", "agents.often": "Fréquence", "agents.on": "Actif", "agents.off": "En pause",
  "inbox.title": "Boîte", "inbox.approve": "Oui, vas-y", "inbox.edit": "Modifier", "inbox.dismiss": "Pas pour moi", "inbox.later": "Plus tard", "inbox.why": "Pourquoi ?",
  "diary.title": "Journal", "diary.sub": "Tout ce que vos agents ont fait, et tout ce que vous leur avez dit.",
  "me.title": "Moi", "me.knows": "Ce qu'OVEREO sait de moi", "me.knowsSub": "Tout ce qu'il a appris, en mots simples. Corrigez ou effacez ce que vous voulez.", "me.forget": "Oublier", "me.correct": "Corriger", "me.tell": "Dire quelque chose à OVEREO", "me.settings": "Réglages", "me.language": "Langue", "me.discreet": "Mode discret", "me.discreetSub": "Notifications neutres et écran discret.", "me.lock": "Verrouillage", "me.lockSub": "Demander un code à l'ouverture.", "me.notifications": "Notifications", "me.export": "Exporter mes données", "me.delete": "Supprimer mon espace", "me.signout": "Se déconnecter", "me.explore": "Découvrir OVEREO",
  "lock.title": "OVEREO est verrouillé", "lock.enter": "Saisissez votre code", "lock.wrong": "Code incorrect", "lock.forgot": "Code oublié",
  "common.save": "Enregistrer", "common.cancel": "Annuler", "common.done": "Terminé", "common.back": "Retour", "common.next": "Suivant", "common.today": "Aujourd'hui", "common.offline": "Hors ligne : vos saisies sont enregistrées sur cet appareil.", "common.englishOnly": "Cet article est en anglais pour le moment.",
};
const PT: Dict = {
  "nav.home": "Início", "nav.today": "Hoje", "nav.track": "Registrar", "nav.si": "Perguntar", "nav.agents": "Agentes", "nav.me": "Eu", "nav.signals": "Sinais", "nav.tests": "Exames", "nav.care": "Cuidado", "nav.more": "Mais", "nav.myspace": "Meu espaço",
  "space.sample": "Exemplo · Maya", "space.mine": "Meu espaço", "space.sampleNote": "Você está vendo o exemplo da Maya. Nada aqui é real.", "space.create": "Criar meu espaço", "space.switchMine": "Ir para meu espaço", "space.switchSample": "Ver o exemplo da Maya",
  "today.hello": "Olá", "today.day": "Dia do ciclo", "today.nextPeriod": "Próxima menstruação", "today.inDays": "em {n} dias", "today.learning": "Quanto o OVEREO te conhece", "today.inbox": "Esperando por você", "today.nothing": "Nada precisa de você agora.", "today.reminders": "Em breve", "today.learned": "O que eu percebi", "today.quickLog": "Registro rápido", "today.recap": "Sua semana",
  "track.title": "Registrar", "track.sub": "Dois toques. Tudo o que você adiciona ensina o OVEREO sobre você.", "track.snap": "Fotografar um laudo", "track.recent": "Registros recentes", "track.saved": "Salvo", "track.period": "Menstruação", "track.symptom": "Sintomas", "track.mood": "Humor", "track.sleep": "Sono", "track.bp": "Pressão arterial", "track.temp": "Temperatura", "track.meds": "Remédio", "track.weight": "Peso", "track.lab": "Resultado de exame",
  "agents.title": "Seus agentes", "agents.sub": "Cada um tem uma tarefa. Eles sugerem, você decide.", "agents.may": "Pode", "agents.never": "Nunca", "agents.often": "Frequência", "agents.on": "Ativo", "agents.off": "Pausado",
  "inbox.title": "Caixa", "inbox.approve": "Sim, faça", "inbox.edit": "Alterar", "inbox.dismiss": "Não é pra mim", "inbox.later": "Depois", "inbox.why": "Por quê?",
  "diary.title": "Diário", "diary.sub": "Tudo o que seus agentes fizeram e tudo o que você disse a eles.",
  "me.title": "Eu", "me.knows": "O que o OVEREO sabe sobre mim", "me.knowsSub": "Tudo o que ele aprendeu, em palavras simples. Corrija ou apague o que quiser.", "me.forget": "Esquecer", "me.correct": "Corrigir", "me.tell": "Contar algo ao OVEREO", "me.settings": "Ajustes", "me.language": "Idioma", "me.discreet": "Modo discreto", "me.discreetSub": "Notificações neutras e tela discreta.", "me.lock": "Bloqueio", "me.lockSub": "Pedir um PIN ao abrir o OVEREO.", "me.notifications": "Notificações", "me.export": "Exportar meus dados", "me.delete": "Excluir meu espaço", "me.signout": "Sair", "me.explore": "Explorar o OVEREO",
  "lock.title": "OVEREO está bloqueado", "lock.enter": "Digite seu PIN", "lock.wrong": "PIN incorreto", "lock.forgot": "Esqueci o PIN",
  "common.save": "Salvar", "common.cancel": "Cancelar", "common.done": "Pronto", "common.back": "Voltar", "common.next": "Próximo", "common.today": "Hoje", "common.offline": "Sem conexão: tudo o que você registrar fica salvo neste aparelho.", "common.englishOnly": "Este artigo está em inglês por enquanto.",
};
const DE: Dict = {
  "nav.home": "Start", "nav.today": "Heute", "nav.track": "Erfassen", "nav.si": "Fragen", "nav.agents": "Agenten", "nav.me": "Ich", "nav.signals": "Signale", "nav.tests": "Tests", "nav.care": "Betreuung", "nav.more": "Mehr", "nav.myspace": "Mein Bereich",
  "space.sample": "Beispiel · Maya", "space.mine": "Mein Bereich", "space.sampleNote": "Du siehst Mayas Beispiel. Nichts davon ist echt.", "space.create": "Meinen Bereich anlegen", "space.switchMine": "Zu meinem Bereich", "space.switchSample": "Mayas Beispiel ansehen",
  "today.hello": "Hallo", "today.day": "Zyklustag", "today.nextPeriod": "Nächste Periode", "today.inDays": "in {n} Tagen", "today.learning": "Wie gut OVEREO dich kennt", "today.inbox": "Wartet auf dich", "today.nothing": "Gerade ist nichts zu tun.", "today.reminders": "Demnächst", "today.learned": "Was mir aufgefallen ist", "today.quickLog": "Schnell erfassen", "today.recap": "Deine Woche",
  "track.title": "Erfassen", "track.sub": "Zwei Tipps. Alles, was du einträgst, lehrt OVEREO, wer du bist.", "track.snap": "Befund fotografieren", "track.recent": "Letzte Einträge", "track.saved": "Gespeichert", "track.period": "Periode", "track.symptom": "Symptome", "track.mood": "Stimmung", "track.sleep": "Schlaf", "track.bp": "Blutdruck", "track.temp": "Temperatur", "track.meds": "Medikament", "track.weight": "Gewicht", "track.lab": "Laborwert",
  "agents.title": "Deine Agenten", "agents.sub": "Jeder hat eine Aufgabe. Sie schlagen vor – du entscheidest.", "agents.may": "Darf", "agents.never": "Niemals", "agents.often": "Wie oft", "agents.on": "Aktiv", "agents.off": "Pausiert",
  "inbox.title": "Eingang", "inbox.approve": "Ja, mach das", "inbox.edit": "Ändern", "inbox.dismiss": "Nicht für mich", "inbox.later": "Später", "inbox.why": "Warum?",
  "diary.title": "Tagebuch", "diary.sub": "Alles, was deine Agenten getan haben – und was du ihnen gesagt hast.",
  "me.title": "Ich", "me.knows": "Was OVEREO über mich weiß", "me.knowsSub": "Alles, was es gelernt hat, in einfachen Worten. Korrigiere oder lösche, was du willst.", "me.forget": "Vergessen", "me.correct": "Korrigieren", "me.tell": "OVEREO etwas sagen", "me.settings": "Einstellungen", "me.language": "Sprache", "me.discreet": "Diskreter Modus", "me.discreetSub": "Neutrale Mitteilungen und ein unauffälliger Bildschirm.", "me.lock": "App-Sperre", "me.lockSub": "Beim Öffnen nach einer PIN fragen.", "me.notifications": "Mitteilungen", "me.export": "Meine Daten exportieren", "me.delete": "Meinen Bereich löschen", "me.signout": "Abmelden", "me.explore": "OVEREO entdecken",
  "lock.title": "OVEREO ist gesperrt", "lock.enter": "PIN eingeben", "lock.wrong": "Die PIN stimmt nicht", "lock.forgot": "PIN vergessen",
  "common.save": "Speichern", "common.cancel": "Abbrechen", "common.done": "Fertig", "common.back": "Zurück", "common.next": "Weiter", "common.today": "Heute", "common.offline": "Offline – alles wird auf diesem Gerät gespeichert.", "common.englishOnly": "Dieser Artikel ist vorerst auf Englisch.",
};
const HI: Dict = {
  "nav.home": "होम", "nav.today": "आज", "nav.track": "दर्ज करें", "nav.si": "पूछें", "nav.agents": "एजेंट", "nav.me": "मैं", "nav.signals": "संकेत", "nav.tests": "जाँचें", "nav.care": "देखभाल", "nav.more": "और", "nav.myspace": "मेरा स्पेस",
  "space.sample": "नमूना · माया", "space.mine": "मेरा स्पेस", "space.sampleNote": "आप माया का नमूना देख रही हैं। यहाँ कुछ भी असली नहीं है।", "space.create": "मेरा स्पेस बनाएँ", "space.switchMine": "मेरे स्पेस पर जाएँ", "space.switchSample": "माया का नमूना देखें",
  "today.hello": "नमस्ते", "today.day": "चक्र का दिन", "today.nextPeriod": "अगला पीरियड", "today.inDays": "{n} दिनों में", "today.learning": "OVEREO आपको कितना जानता है", "today.inbox": "आपका इंतज़ार", "today.nothing": "अभी कुछ करने की ज़रूरत नहीं।", "today.reminders": "आगे", "today.learned": "मैंने क्या देखा", "today.quickLog": "जल्दी दर्ज करें", "today.recap": "आपका सप्ताह",
  "track.title": "दर्ज करें", "track.sub": "दो टैप। आप जो भी जोड़ती हैं, उससे OVEREO आपको बेहतर समझता है।", "track.snap": "रिपोर्ट की फ़ोटो लें", "track.recent": "हाल की प्रविष्टियाँ", "track.saved": "सहेजा गया", "track.period": "पीरियड", "track.symptom": "लक्षण", "track.mood": "मूड", "track.sleep": "नींद", "track.bp": "ब्लड प्रेशर", "track.temp": "तापमान", "track.meds": "दवा", "track.weight": "वज़न", "track.lab": "लैब रिपोर्ट",
  "agents.title": "आपके एजेंट", "agents.sub": "हर एक का एक काम है। वे सुझाव देते हैं — फ़ैसला आपका।", "agents.may": "कर सकता है", "agents.never": "कभी नहीं", "agents.often": "कितनी बार", "agents.on": "चालू", "agents.off": "रुका हुआ",
  "inbox.title": "इनबॉक्स", "inbox.approve": "हाँ, कर दो", "inbox.edit": "बदलें", "inbox.dismiss": "मेरे लिए नहीं", "inbox.later": "बाद में", "inbox.why": "क्यों?",
  "diary.title": "डायरी", "diary.sub": "आपके एजेंटों ने जो किया — और आपने उन्हें जो बताया।",
  "me.title": "मैं", "me.knows": "OVEREO मेरे बारे में क्या जानता है", "me.knowsSub": "जो कुछ उसने सीखा, आसान शब्दों में। कुछ भी सुधारें या भुला दें।", "me.forget": "भूल जाओ", "me.correct": "सुधारें", "me.tell": "OVEREO को कुछ बताएँ", "me.settings": "सेटिंग्स", "me.language": "भाषा", "me.discreet": "गोपनीय मोड", "me.discreetSub": "सामान्य सूचनाएँ और निजी दिखने वाली स्क्रीन।", "me.lock": "ऐप लॉक", "me.lockSub": "खोलते समय PIN माँगें।", "me.notifications": "सूचनाएँ", "me.export": "मेरा डेटा निर्यात करें", "me.delete": "मेरा स्पेस मिटाएँ", "me.signout": "साइन आउट", "me.explore": "OVEREO देखें",
  "lock.title": "OVEREO लॉक है", "lock.enter": "अपना PIN डालें", "lock.wrong": "PIN मेल नहीं खाया", "lock.forgot": "PIN भूल गईं",
  "common.save": "सहेजें", "common.cancel": "रद्द करें", "common.done": "हो गया", "common.back": "वापस", "common.next": "आगे", "common.today": "आज", "common.offline": "आप ऑफ़लाइन हैं — सब कुछ इसी डिवाइस पर सहेजा जा रहा है।", "common.englishOnly": "यह लेख अभी अंग्रेज़ी में है।",
};
const PA: Dict = {
  "nav.home": "ਹੋਮ", "nav.today": "ਅੱਜ", "nav.track": "ਦਰਜ ਕਰੋ", "nav.si": "ਪੁੱਛੋ", "nav.agents": "ਏਜੰਟ", "nav.me": "ਮੈਂ", "nav.signals": "ਸੰਕੇਤ", "nav.tests": "ਟੈਸਟ", "nav.care": "ਦੇਖਭਾਲ", "nav.more": "ਹੋਰ", "nav.myspace": "ਮੇਰੀ ਥਾਂ",
  "space.sample": "ਨਮੂਨਾ · ਮਾਇਆ", "space.mine": "ਮੇਰੀ ਥਾਂ", "space.sampleNote": "ਤੁਸੀਂ ਮਾਇਆ ਦਾ ਨਮੂਨਾ ਵੇਖ ਰਹੇ ਹੋ। ਇੱਥੇ ਕੁਝ ਵੀ ਅਸਲੀ ਨਹੀਂ।", "space.create": "ਮੇਰੀ ਥਾਂ ਬਣਾਓ", "space.switchMine": "ਮੇਰੀ ਥਾਂ 'ਤੇ ਜਾਓ", "space.switchSample": "ਮਾਇਆ ਦਾ ਨਮੂਨਾ ਵੇਖੋ",
  "today.hello": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "today.day": "ਚੱਕਰ ਦਾ ਦਿਨ", "today.nextPeriod": "ਅਗਲਾ ਪੀਰੀਅਡ", "today.inDays": "{n} ਦਿਨਾਂ ਵਿੱਚ", "today.learning": "OVEREO ਤੁਹਾਨੂੰ ਕਿੰਨਾ ਜਾਣਦਾ ਹੈ", "today.inbox": "ਤੁਹਾਡੀ ਉਡੀਕ", "today.nothing": "ਹੁਣੇ ਕੁਝ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ।", "today.reminders": "ਅੱਗੇ", "today.learned": "ਮੈਂ ਕੀ ਵੇਖਿਆ", "today.quickLog": "ਜਲਦੀ ਦਰਜ", "today.recap": "ਤੁਹਾਡਾ ਹਫ਼ਤਾ",
  "track.title": "ਦਰਜ ਕਰੋ", "track.sub": "ਦੋ ਟੈਪ। ਜੋ ਵੀ ਤੁਸੀਂ ਜੋੜਦੇ ਹੋ, ਉਸ ਨਾਲ OVEREO ਤੁਹਾਨੂੰ ਸਮਝਦਾ ਹੈ।", "track.snap": "ਰਿਪੋਰਟ ਦੀ ਫ਼ੋਟੋ", "track.recent": "ਹਾਲੀਆ ਐਂਟਰੀਆਂ", "track.saved": "ਸੰਭਾਲਿਆ", "track.period": "ਪੀਰੀਅਡ", "track.symptom": "ਲੱਛਣ", "track.mood": "ਮੂਡ", "track.sleep": "ਨੀਂਦ", "track.bp": "ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ", "track.temp": "ਤਾਪਮਾਨ", "track.meds": "ਦਵਾਈ", "track.weight": "ਭਾਰ", "track.lab": "ਲੈਬ ਨਤੀਜਾ",
  "agents.title": "ਤੁਹਾਡੇ ਏਜੰਟ", "agents.sub": "ਹਰੇਕ ਦਾ ਇੱਕ ਕੰਮ ਹੈ। ਉਹ ਸੁਝਾਅ ਦਿੰਦੇ ਹਨ — ਫ਼ੈਸਲਾ ਤੁਹਾਡਾ।", "agents.may": "ਕਰ ਸਕਦਾ ਹੈ", "agents.never": "ਕਦੇ ਨਹੀਂ", "agents.often": "ਕਿੰਨੀ ਵਾਰ", "agents.on": "ਚਾਲੂ", "agents.off": "ਰੁਕਿਆ",
  "inbox.title": "ਇਨਬਾਕਸ", "inbox.approve": "ਹਾਂ, ਕਰੋ", "inbox.edit": "ਬਦਲੋ", "inbox.dismiss": "ਮੇਰੇ ਲਈ ਨਹੀਂ", "inbox.later": "ਬਾਅਦ ਵਿੱਚ", "inbox.why": "ਕਿਉਂ?",
  "diary.title": "ਡਾਇਰੀ", "diary.sub": "ਤੁਹਾਡੇ ਏਜੰਟਾਂ ਨੇ ਜੋ ਕੀਤਾ — ਅਤੇ ਤੁਸੀਂ ਜੋ ਦੱਸਿਆ।",
  "me.title": "ਮੈਂ", "me.knows": "OVEREO ਮੇਰੇ ਬਾਰੇ ਕੀ ਜਾਣਦਾ ਹੈ", "me.knowsSub": "ਜੋ ਕੁਝ ਉਸ ਨੇ ਸਿੱਖਿਆ, ਸੌਖੇ ਸ਼ਬਦਾਂ ਵਿੱਚ। ਕੁਝ ਵੀ ਠੀਕ ਕਰੋ ਜਾਂ ਭੁਲਾ ਦਿਓ।", "me.forget": "ਭੁੱਲ ਜਾਓ", "me.correct": "ਠੀਕ ਕਰੋ", "me.tell": "OVEREO ਨੂੰ ਕੁਝ ਦੱਸੋ", "me.settings": "ਸੈਟਿੰਗਾਂ", "me.language": "ਭਾਸ਼ਾ", "me.discreet": "ਗੁਪਤ ਮੋਡ", "me.discreetSub": "ਆਮ ਸੂਚਨਾਵਾਂ ਅਤੇ ਨਿੱਜੀ ਸਕਰੀਨ।", "me.lock": "ਐਪ ਲਾਕ", "me.lockSub": "ਖੋਲ੍ਹਣ ਵੇਲੇ PIN ਮੰਗੋ।", "me.notifications": "ਸੂਚਨਾਵਾਂ", "me.export": "ਮੇਰਾ ਡਾਟਾ ਨਿਰਯਾਤ ਕਰੋ", "me.delete": "ਮੇਰੀ ਥਾਂ ਮਿਟਾਓ", "me.signout": "ਸਾਈਨ ਆਉਟ", "me.explore": "OVEREO ਵੇਖੋ",
  "lock.title": "OVEREO ਲਾਕ ਹੈ", "lock.enter": "ਆਪਣਾ PIN ਪਾਓ", "lock.wrong": "PIN ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ", "lock.forgot": "PIN ਭੁੱਲ ਗਏ",
  "common.save": "ਸੰਭਾਲੋ", "common.cancel": "ਰੱਦ ਕਰੋ", "common.done": "ਹੋ ਗਿਆ", "common.back": "ਪਿੱਛੇ", "common.next": "ਅੱਗੇ", "common.today": "ਅੱਜ", "common.offline": "ਤੁਸੀਂ ਔਫ਼ਲਾਈਨ ਹੋ — ਸਭ ਕੁਝ ਇਸੇ ਡਿਵਾਈਸ 'ਤੇ ਸੰਭਾਲਿਆ ਜਾ ਰਿਹਾ ਹੈ।", "common.englishOnly": "ਇਹ ਲੇਖ ਹਾਲੇ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਹੈ।",
};
const ZH: Dict = {
  "nav.home": "首页", "nav.today": "今天", "nav.track": "记录", "nav.si": "提问", "nav.agents": "助手", "nav.me": "我的", "nav.signals": "信号", "nav.tests": "检测", "nav.care": "护理", "nav.more": "更多", "nav.myspace": "我的空间",
  "space.sample": "示例 · Maya", "space.mine": "我的空间", "space.sampleNote": "你正在查看 Maya 的示例，这里的内容都不是真实数据。", "space.create": "创建我的空间", "space.switchMine": "切换到我的空间", "space.switchSample": "查看 Maya 的示例",
  "today.hello": "你好", "today.day": "周期第", "today.nextPeriod": "下次经期", "today.inDays": "{n} 天后", "today.learning": "OVEREO 对你的了解", "today.inbox": "待你处理", "today.nothing": "目前没有需要处理的事项。", "today.reminders": "即将到来", "today.learned": "我注意到的", "today.quickLog": "快速记录", "today.recap": "你的一周",
  "track.title": "记录", "track.sub": "轻点两下即可。你记录的每一项都让 OVEREO 更了解你。", "track.snap": "拍摄报告", "track.recent": "最近记录", "track.saved": "已保存", "track.period": "经期", "track.symptom": "症状", "track.mood": "心情", "track.sleep": "睡眠", "track.bp": "血压", "track.temp": "体温", "track.meds": "药物", "track.weight": "体重", "track.lab": "化验结果",
  "agents.title": "你的助手", "agents.sub": "每个助手只负责一件事。它们提出建议，由你决定。", "agents.may": "可以", "agents.never": "绝不", "agents.often": "频率", "agents.on": "已开启", "agents.off": "已暂停",
  "inbox.title": "收件箱", "inbox.approve": "好的，执行", "inbox.edit": "修改", "inbox.dismiss": "不适合我", "inbox.later": "稍后", "inbox.why": "为什么？",
  "diary.title": "日志", "diary.sub": "助手做过的每件事，以及你告诉它们的一切。",
  "me.title": "我的", "me.knows": "OVEREO 对我的了解", "me.knowsSub": "它学到的一切，用简单的话说明。你可以更正或删除任何一项。", "me.forget": "忘记", "me.correct": "更正", "me.tell": "告诉 OVEREO 一些事", "me.settings": "设置", "me.language": "语言", "me.discreet": "隐私模式", "me.discreetSub": "中性的通知和低调的界面。", "me.lock": "应用锁", "me.lockSub": "打开时需要输入 PIN。", "me.notifications": "通知", "me.export": "导出我的数据", "me.delete": "删除我的空间", "me.signout": "退出登录", "me.explore": "探索 OVEREO",
  "lock.title": "OVEREO 已锁定", "lock.enter": "输入你的 PIN", "lock.wrong": "PIN 不正确", "lock.forgot": "忘记 PIN",
  "common.save": "保存", "common.cancel": "取消", "common.done": "完成", "common.back": "返回", "common.next": "下一步", "common.today": "今天", "common.offline": "当前离线——你记录的内容会保存在这台设备上。", "common.englishOnly": "本文暂时只有英文版。",
};

const DICTS: Record<Lang, Dict> = { en: EN, es: ES, fr: FR, pt: PT, de: DE, hi: HI, pa: PA, zh: ZH };

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>) {
  let s = DICTS[lang]?.[key] ?? EN[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
