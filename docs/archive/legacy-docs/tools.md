# Tools Overview

`rec_to_nwb_yaml_creator` uses basic web development tools. Like -

## Standard Tools

- **_Javascript_**: Language originally intended to make web pages dynamic, like blink text. Javascript files end with the extension `.js`. It's syntax can be understood easily by a developer familiar with Python. It is sometimes called _vanilla Javascript_ to distinguish it from Typescript (<https://www.typescriptlang.org/>.) Typescript (<https://www.typescriptlang.org/>) is a non-standard subset of Javascript developed by Microsoft (<http://www.microsoft.com>). Typescript (<https://www.typescriptlang.org/>.) files end with the extension `.ts`. The part of the code based from [Electron React Boilerplate] (<https://github.com/electron-react-boilerplate/electron-react-boilerplate>.) is written in Typescript. The part of the code specific to `rec_to_nwb_yaml_creator` was written in Javascript. This was done partially because one of `rec_to_nwb_yaml_creator` (Phil) interest in sticking with standard _vanilla Javascript_  and partially to help Python developer not having a additional thing to learn to maintain this application.

Javascript has a lot of similarities to Python. For example, Python's lambda (<https://www.w3schools.com/python/python_lambda.asp>) is similar to Javascript's arrow function (<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions>). Javascript also has things not in Python like spread (<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax>)

- **_HyperText Markup Language_** Markup for building user interfaces. The version `rec_to_nwb_yaml_creator` uses is called HTML5 (<https://en.wikipedia.org/wiki/HTML5>).

- **_Cascading style sheets (CSS)_** Style sheet for describing the look-and-feel of an application. CSS (<https://en.wikipedia.org/wiki/CSS>) is stored in file ending in `.css`. There are many tutorial on CSS (<https://en.wikipedia.org/wiki/CSS>) like TutorialPoint (<https://www.tutorialspoint.com/css/index.htm>).

## React

`rec_to_nwb_yaml_creator` uses many third-party libraries. You can find a list in the `package.json` file. A very important third-party library is React (<https://reactjs.org/>.) React (<https://reactjs.org/>) frequently reinvents itself. `rec_to_nwb_yaml_creator` uses hooks (<https://reactjs.org/docs/hooks-intro.html>.) A basically tutorial can be found on w3school (<https://www.w3schools.com/react/react_hooks.asp>.)

A detailed discussion of React (<https://reactjs.org/>) is beyond the scope of this developer page. But this page will provide the basic.

### React Hooks

Hooks (<https://reactjs.org/docs/hooks-intro.html>) are a way to create _Virtual DOM_ (<https://en.wikipedia.org/wiki/Virtual_DOM>) (to be discussed later) and other features of react without using classes (<https://en.wikipedia.org/wiki/Class_%28computer_programming%29#:~:text=Class%20%28computer%20programming%29%20In%20object-oriented%20programming%2C%20a%20class,and%20implementations%20of%20behavior%20%28member%20functions%20or%20methods%29.>) It is simpler to use than over iterations of React (<https://reactjs.org/>) like Components (<https://reactjs.org/docs/react-component.html>.) `rec_to_nwb_yaml_creator` only uses Hooks (<https://reactjs.org/docs/hooks-intro.html>.)

React [state](<https://www.w3schools.com/react/react_state.asp>) is used to tie a Javascript object to user interface. The user interface is updated if the Javascript object is updated.

React [useEffect](<https://www.w3schools.com/react/react_useeffect.asp>) is the standard way to encapsulate request for page changes made by resources and to react, like a request to read in a file.

React [useRef](<https://www.w3schools.com/react/react_useref.asp>) persist changes across major page updates. It is not as heavy as [state](<https://www.w3schools.com/react/react_state.asp>), so preferred when a Javascript object need to be persisted but not not directly modify the user interface.

### Virtual DOM

Web applications make many changes. Javascript changing HTML is slow but very fast if done in Javascript itself. The React (<https://reactjs.org/>) made react modify HTML in Javascript as much as needed; and then output a final HTML when processing is completed. This is the core concept of _Virtual DOM_ (<https://en.wikipedia.org/wiki/Virtual_DOM>). DOM standard for _Document object model_ as is essentially a programming interface for interacting with a page entire HTML set. _Virtual DOM_ (<https://en.wikipedia.org/wiki/Virtual_DOM>) is a term defined by Meta (<http://meta.com/>), originally for Facebook (<http://www.facebook.com>) for describing the core behavior of React (<https://reactjs.org/>.) In `rec_to_nwb_yaml_creator`, Javascript pages that use _Virtual DOM_ (<https://en.wikipedia.org/wiki/Virtual_DOM>) end with `.jsx` file extension. Outside `rec_to_nwb_yaml_creator`, some developer choose to end file with `.js` extension. Other libraries and frameworks like Google's (<http://wwww.google.com>) Angular (<https://angular.io/>) have borrowed this approach. When you see a function that has a return that looks like html, you are dealing with _Virtual DOM_ (<https://en.wikipedia.org/wiki/Virtual_DOM>).

HTML5 (<https://en.wikipedia.org/wiki/HTML5>) const of tags like `<span></span>` (for basic text), `<div></div>` (division/region), `<p></p>` (paragraph) and many others (<https://www.tutorialrepublic.com/html-reference/html5-tags.php>). In the early days of HTML, companies could define tags at will. That is why we have tags that do the same thing like `<i><i>`
and `<em></em>` that essentially do the same thing. This ended when a consorted effort was made to vet the usefulness of tags before they would become standard. It is a slow progress that can take years and be rejected. React has a system where you can build a custom tag. An example if `InputElement` found in `./../src/renderer/InputElement.jsx`. It consist of div tags and other tags. Other files in `rec_to_nwb_yaml_creator` can now use `<InputElement></InputElement>` if desired. Note, standard HTML5 (<https://en.wikipedia.org/wiki/HTML5>) always standard with lower case like `<select></select>` while custom tags start with upper case like `<InputElement></InputElement>`. React (<https://reactjs.org/>) has a special tag called fragment (<https://reactjs.org/docs/fragments.html>) with syntax - `<></>`. React (<https://reactjs.org/>) requires every function that returns React (<https://reactjs.org/>)  _Virtual DOM_ be incased in a parent tag. One option is to use `<div></div>` which brings along associated style or use a fragment (<https://reactjs.org/docs/fragments.html>) which has no styling associate with it.

There is a lot more to React (<https://reactjs.org/>.) It is recommended you use your favor search engine like Google (<http://www.google.com>) or bing (<http://www.bing.com>) to look at any part of `rec_to_nwb_yaml_creator` you don't understand. That is an effective way to learn. A similar idea applies to some Javascript concepts that `rec_to_nwb_yaml_creator`.


## Validation

[ajv](<https://ajv.js.org/>) is the library used to validation user input or an updated yml file against [JSON schema](https://json-schema.org/). The `rec_to_nwb_yaml_creator` [JSON schema](https://json-schema.org/) file used is `./../assets/jsonSchema.json`.
