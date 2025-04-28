# Installation
```bash
git clone https://github.com/infatoshi/chat
cd chat
npm install
cp .env.example .env
```
fill in OPENROUTER_API_KEY as your own in `.env`
run: 
`npm run tauri dev`

# TODO

## Now
- option to display thinking models with a "thinking" bool option in models.json
- stop streaming tokens button
- copy button for code blocks

## Soon
- parallel chats (move between with cmd + [ and cmd + ])

## Later
- RAG memory feature


## DONE
- center the output response like grok.com (crammed rn)
- edit option for any prompt
- handle 
    - **
    - *
    - ``
    - ```python```
    - ```javascript```
    - ```bash```
    - ```cpp```
    - "-"
    - <br>
    - #
    - ##
    - ###
- custom system prompts
- delete models setting
- settings menu with:
    - a scale slider for EVERYTHING
    - max new tokens
    - temperature
- remove the cursor in input message and only starting in output message
- ensure chats are written to conversations.json
- option to delete chats
- cautious enter key
- keybind to hide/show conversation list
- convo logs in -> `/Users/elliotarledge/Library/Application Support/com.chat.app/chat_conversations`
