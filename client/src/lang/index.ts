import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./en.json"
import sk from "./sk.json"
import ja from "./ja.json"
import zh from "./zh.json"
import ko from "./ko.json"

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            sk: { translation: sk },
            ja: { translation: ja },
            zh: { translation: zh },
            ko: { translation: ko }
        },
        fallbackLng: "en",
        interpolation: { escapeValue: false },
    })

export default i18n