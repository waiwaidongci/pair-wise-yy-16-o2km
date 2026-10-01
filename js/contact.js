/* contact.js — 联系页：表单校验与反馈（无刷新） */

const Contact = {
  init() {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return;
    const feedback = form.querySelector("[data-form-feedback]");

    const validators = {
      name: (v) => (v.trim() ? "" : "请填写您的姓名。"),
      email: (v) => {
        if (!v.trim()) return "请填写邮箱地址。";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "邮箱格式不正确。";
        return "";
      },
      message: (v) => (v.trim() ? "" : "请填写留言内容。"),
    };

    const validateField = (field) => {
      const input = field.querySelector("input, textarea, select");
      const err = field.querySelector(".err");
      const fn = validators[input.name];
      const msg = fn ? fn(input.value) : "";
      field.classList.toggle("invalid", !!msg);
      if (err) err.textContent = msg;
      return !msg;
    };

    form.querySelectorAll(".field").forEach((field) => {
      const input = field.querySelector("input, textarea, select");
      input.addEventListener("blur", () => validateField(field));
      input.addEventListener("input", () => {
        if (field.classList.contains("invalid")) validateField(field);
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      form.querySelectorAll(".field").forEach((field) => {
        if (!validateField(field)) ok = false;
      });
      if (!ok) {
        feedback.className = "form-feedback fail";
        feedback.textContent = "请检查标红的字段后再提交。";
        return;
      }
      // Simulate sending (static demo).
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      btn.textContent = "发送中…";
      feedback.className = "form-feedback";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "发送留言";
        feedback.className = "form-feedback ok";
        feedback.textContent = "留言已发送，我会尽快回复。感谢您的联系！";
        form.reset();
        form.querySelectorAll(".field").forEach((f) => f.classList.remove("invalid"));
      }, 700);
    });
  },
};

document.addEventListener("DOMContentLoaded", () => Contact.init());
