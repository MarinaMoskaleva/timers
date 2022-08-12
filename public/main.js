/*global UIkit, Vue */

(() => {
  const notification = (config) =>
    UIkit.notification({
      pos: "top-right",
      timeout: 5000,
      ...config,
    });

  const alert = (message) =>
    notification({
      message,
      status: "danger",
    });

  const info = (message) =>
    notification({
      message,
      status: "success",
    });

  new Vue({
    el: "#app",
    data: {
      desc: "",
      activeTimers: [],
      oldTimers: [],
      client: null,
    },
    methods: {
      createTimer() {
        const description = this.desc;
        this.desc = "";
        this.client.send(
          JSON.stringify({
            type: "create_timer",
            description,
          })
        );
      },
      stopTimer(_id) {
        this.client.send(
          JSON.stringify({
            type: "stop_timer",
            timerId: _id,
          })
        );
      },
      formatTime(ts) {
        return new Date(ts).toTimeString().split(" ")[0];
      },
      formatDuration(d) {
        d = Math.floor(d / 1000);
        const s = d % 60;
        d = Math.floor(d / 60);
        const m = d % 60;
        const h = Math.floor(d / 60);
        return [h > 0 ? h : null, m, s]
          .filter((x) => x !== null)
          .map((x) => (x < 10 ? "0" : "") + x)
          .join(":");
      },
    },
    created() {
      const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
      this.client = new WebSocket(`${wsProto}//${location.host}`);
      this.client.addEventListener("open", () => {
        console.log("open!!!");
      });
      this.client.addEventListener("message", (message) => {
        let data;
        try {
          data = JSON.parse(message.data);
        } catch (err) {
          return;
        }
        if (data.type === "all_timers") {
          this.activeTimers = data.userTimers.filter((item) => item.isActive);
          this.activeTimers.forEach((item) => {
            item.progress = new Date() - new Date(item.start);
          });
          this.oldTimers = data.userTimers.filter((item) => !item.isActive);
        }
        if (data.type === "active_timers") {
          this.activeTimers = data.userTimers;
        }
        if (data.type === "create_timer_success") {
          info(`Created new timer "${data.description}" [${data.timerId}]`);
        }
        if (data.type === "stop_timer_success") {
          info(`Stopped the timer [${data.timerId}]`);
        }
        if (data.type === "error_message") {
          alert(`Error [${data.text}]`);
        }
      });
    },
  });
})();
