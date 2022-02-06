let slider = document.querySelectorAll(".hdSlider img");
let dot = document.querySelectorAll(".dots .dot");
dot.forEach((item, index) => {
    item.addEventListener("click", function(){
        dot = Array.from(dot);
        let ok = dot.indexOf(document.querySelector(".active"));
        slider.forEach((it, inx) => {
            if(item.classList.contains("active")){
            } else {
                if(index < ok){
                    let slideAnimate = slider[index].animate([
                        {left: "-100%"},
                        {left: "0"}
                    ], {duration: 700});
                    it.animate([
                        {left: "0"},
                        {left: "100%"}
                    ], {duration: 700});
                        slider[index].classList.add("this");
                        slider[index].classList.remove("none");
                    slideAnimate.addEventListener("finish", function(){
                        slider[inx].classList.add("none");
                        slider[inx].classList.remove("this");
                        slider[index].classList.add("this");
                        slider[index].classList.remove("none");
                    });
                } else if (index > ok){
                    let slideAnimate = it.animate([
                        {left: "0"},
                        {left: "-100%"}
                    ], {duration: 700});
                    slider[index].animate([
                        {left: "100%"},
                        {left: "0"}
                    ], {duration: 700});
                        slider[index].classList.add("this");
                        slider[index].classList.remove("none");
                    slideAnimate.addEventListener("finish", function(){
                        slider[inx].classList.add("none");
                        slider[inx].classList.remove("this");
                        slider[index].classList.add("this");
                        slider[index].classList.remove("none");
                    });
                };
            };
        });
        for(let i = 0; i < dot.length; i++){
            dot[i].classList.remove("active");
            item.classList.add("active");
        };
    });
});