function collectLessonSummary(form){const topic=form.elements.lessonTopic.value.trim(),summary=form.elements.lessonSummary.value.trim(),concepts=form.elements.lessonConcepts.value.trim();return topic||summary||concepts?{topic,summary,concepts}:null;}
function renderLessonSummary(container,lesson){
 if(!lesson||(!lesson.topic&&!lesson.summary&&!lesson.concepts))return;
 const box=el('section',null,'notice');box.style.cssText='background:#eef4ed;margin-top:14px';box.append(el('b','📚 מה למדנו בשיעור?'));
 if(lesson.topic)box.append(userEl('h4',lesson.topic));
 if(lesson.summary){const text=userEl('p',lesson.summary);text.style.whiteSpace='pre-wrap';box.append(text)}
 if(lesson.concepts)box.append(el('div','מושגים חדשים: '+lesson.concepts,'meta'));
 container.append(box);
}
