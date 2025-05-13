document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("survey_select");
  const btn = document.getElementById("start_btn");

  // 1) Загрузить все активные опросы (гости — только анонимные)
  fetch("/api/method/eva_survey.api.survey.get_surveys_list")
    .then(r => r.json())
    .then(r => {
      sel.innerHTML = "<option value=''>— выберите —</option>";
      r.message.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.textContent = s.title + (s.is_anonymous ? " (анон.)" : "");
        sel.append(opt);
      });
    })
    .catch(() => {
      sel.innerHTML = "<option value=''>Ошибка загрузки</option>";
    });

  // 2) Активация кнопки
  sel.addEventListener("change", () => {
    btn.disabled = !sel.value;
  });

  // 3) При переходе на страницу опроса
  btn.addEventListener("click", () => {
    const name = encodeURIComponent(sel.value);
    window.location.href = `/survey?survey=${name}`;
  });
});
