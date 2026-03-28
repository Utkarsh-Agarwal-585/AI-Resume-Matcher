export function preprocessText(text, limit = 10000){
    return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}
