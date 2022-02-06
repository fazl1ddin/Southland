let feedback = document.querySelectorAll(".mainFeedbackContentBoxex");
let buttones = document.querySelectorAll(".bullet");
buttones.forEach((item, index) => {
    item.addEventListener("click", function(){
        feedback.forEach((it, inx) => {
            let feedAnimate = feedback[index].animate([
                {transform: "translateX(0)"},
                {transform: "translateX(100%)"}
            ], {duration: 1000});
            it.animate([
                {transform: "translateX(-100%)"},
                {transform: "translateX(0)"}
            ], {duration: 1000});
            feedback[index].classList.add("visa");
            feedAnimate.addEventListener("finish", function(){
                it.classList.remove("visa");
                feedback[index].classList.add("visa");
            })
        });
    });
});